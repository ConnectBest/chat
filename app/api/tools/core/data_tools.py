from typing import List, Dict, Any, Optional
import numpy as np
from .db import db_instance

# MongoDB Atlas Vector Search Configuration
VECTOR_INDEX_NAME = "vector_index"
VECTOR_FIELD_NAME = "embedding"
# Embeddings are stored in separate 'message_embeddings' collection
EMBEDDINGS_COLLECTION = "message_embeddings"


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Compute cosine similarity between two vectors (fallback)."""
    a = np.array(vec1)
    b = np.array(vec2)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))


def resolve_channel_id(channel_identifier: str, db) -> Optional[str]:
    """
    Resolve a channel name or ID to a channel UUID.
    Handles both channel names (e.g., 'general') and UUIDs.
    """
    if not channel_identifier:
        return None
    
    # Check if it's already a UUID (contains dashes and is 36 chars)
    if len(channel_identifier) == 36 and '-' in channel_identifier:
        # Verify it exists
        if db.channels.find_one({"id": channel_identifier}):
            return channel_identifier
    
    # Try to find by name (case-insensitive)
    channel = db.channels.find_one({"name": {"$regex": f"^{channel_identifier}$", "$options": "i"}})
    if channel:
        return channel["id"]
    
    return None

def get_user_scope(user_id: str) -> Dict[str, Any]:
    """Get the user's accessible scope (channels, users)."""
    try:
        db = db_instance.get_db()
        if db is None:
            return {"channels": [], "user_ids": []}
        
        # Get channels user is member of
        memberships = list(db.channel_members.find({"user_id": user_id}))
        channel_ids = [m["channel_id"] for m in memberships]
        
        # Get all users in those channels
        if channel_ids:
            channel_members = db.channel_members.find({"channel_id": {"$in": channel_ids}})
            user_ids = list(set(m["user_id"] for m in channel_members))
        else:
            user_ids = [user_id]
        
        return {
            "channels": channel_ids,
            "user_ids": user_ids
        }
    except Exception as e:
        print(f"Error getting user scope: {e}")
        return {"channels": [], "user_ids": []}

def search_vector_db(query: str, scope_channels: List[str], top_k: int = 10, filter_author: str = None) -> Dict[str, Any]:
    """
    Search messages using Atlas Vector Search on message_embeddings collection.
    Falls back to cosine similarity if vector search fails.
    """
    try:
        db = db_instance.get_db()
        embedding_model = db_instance.get_embedding_model()
        
        if db is None:
            return {"results": [], "message": "Database not available", "error": True}
        
        if embedding_model is None:
            return {"results": [], "message": "Embedding model not available", "error": True}
        
        if not scope_channels:
            return {"results": [], "message": "No channels in scope", "count": 0}
        
        # Generate query embedding
        query_embedding = embedding_model.encode(query).tolist()
        
        # Use Atlas Vector Search on message_embeddings collection
        pipeline = [
            {
                "$vectorSearch": {
                    "index": VECTOR_INDEX_NAME,
                    "path": VECTOR_FIELD_NAME,
                    "queryVector": query_embedding,
                    "numCandidates": top_k * 20,
                    "limit": top_k * 5  # Get more to filter by scope
                }
            },
            {
                "$addFields": {
                    "relevance_score": {"$meta": "vectorSearchScore"}
                }
            },
            # Join with messages to get text and channel_id
            {
                "$lookup": {
                    "from": "messages",
                    "localField": "message_id",
                    "foreignField": "id",
                    "as": "message_info"
                }
            },
            {"$unwind": "$message_info"},
            # Filter by scope channels
            {
                "$match": {
                    "message_info.channel_id": {"$in": scope_channels}
                }
            },
            # Join with users for author name
            {
                "$lookup": {
                    "from": "users",
                    "localField": "author_id",
                    "foreignField": "id",
                    "as": "author_info"
                }
            },
            # Join with channels for channel name
            {
                "$lookup": {
                    "from": "channels",
                    "localField": "message_info.channel_id",
                    "foreignField": "id",
                    "as": "channel_info"
                }
            },
            # Project final shape
            {
                "$project": {
                    "message_id": 1,
                    "text": "$message_info.text",
                    "author_id": 1,
                    "author_name": {"$ifNull": [{"$arrayElemAt": ["$author_info.display_name", 0]}, "Unknown"]},
                    "channel_id": "$message_info.channel_id",
                    "channel_name": {"$ifNull": [{"$arrayElemAt": ["$channel_info.name", 0]}, "Unknown"]},
                    "created_at": "$message_info.created_at",
                    "relevance_score": 1,
                    "_id": 0
                }
            },
            {"$limit": top_k}
        ]
        
        # Add author filter if specified
        if filter_author:
            pipeline.insert(5, {"$match": {"author_id": filter_author}})
        
        results = list(db[EMBEDDINGS_COLLECTION].aggregate(pipeline))
        return {"results": results, "count": len(results), "method": "atlas_vector_search"}
    
    except Exception as e:
        print(f"Error in search_vector_db: {e}")
        import traceback
        traceback.print_exc()
        return {"results": [], "message": f"Search failed: {str(e)}", "error": True}

def fetch_slack_history(channel_id: str, limit: int = 50, thread_ts: str = None) -> Dict[str, Any]:
    """Fetch message history from a channel."""
    db = db_instance.get_db()
    if db is None:
        return {"messages": [], "message": "Database not available"}
    
    query = {"channel_id": channel_id}
    if thread_ts:
        query["parent_id"] = thread_ts  # Use parent_id for threads per schema
    
    messages = list(db.messages.find(query).sort("created_at", -1).limit(limit))
    messages.reverse()  # Chronological order
    
    # Enrich with user info
    results = []
    for msg in messages:
        # Schema uses author_id, not user
        author_id = msg.get("author_id", "")
        user = db.users.find_one({"id": author_id})
        results.append({
            "text": msg.get("text", ""),
            "user_id": author_id,
            "user_name": user.get("display_name", "Unknown") if user else "Unknown",
            "timestamp": msg.get("created_at", ""),
            "thread_ts": msg.get("parent_id")
        })
    
    return {"messages": results, "count": len(results)}

def find_users(search_term: str, scope_user_ids: List[str]) -> Dict[str, Any]:
    """Find users by name, email, or username within scope."""
    db = db_instance.get_db()
    if db is None:
        return {"users": [], "message": "Database not available"}
    
    regex_query = {"$regex": search_term, "$options": "i"}
    user_match = {
        "$or": [
            {"display_name": regex_query},
            {"username": regex_query},
            {"email": regex_query}
        ],
        "id": {"$in": scope_user_ids}
    }
    
    users = list(db.users.find(user_match))
    
    results = []
    for user in users:
        results.append({
            "user_id": user["id"],
            "display_name": user.get("display_name", ""),
            "username": user.get("username", ""),
            "email": user.get("email", ""),
            "avatar": user.get("avatar", "")
        })
    
    return {"users": results, "count": len(results)}

def get_user_profile(user_id: str, scope_user_ids: List[str]) -> Dict[str, Any]:
    """Get detailed user profile."""
    db = db_instance.get_db()
    if db is None:
        return {"user": None, "message": "Database not available"}
    
    if user_id not in scope_user_ids:
        return {"user": None, "message": "User not in accessible scope"}
    
    user = db.users.find_one({"id": user_id})
    if not user:
        return {"user": None, "message": "User not found"}
    
    return {
        "user": {
            "user_id": user["id"],
            "display_name": user.get("display_name", ""),
            "username": user.get("username", ""),
            "email": user.get("email", ""),
            "avatar": user.get("avatar", ""),
            "status": user.get("status", ""),
            "timezone": user.get("timezone", "")
        }
    }

def get_channel_info(channel_id: str, scope_channels: List[str]) -> Dict[str, Any]:
    """Get channel information."""
    db = db_instance.get_db()
    if db is None:
        return {"channel": None, "message": "Database not available"}
    
    if channel_id not in scope_channels:
        return {"channel": None, "message": "Channel not accessible"}
    
    channel = db.channels.find_one({"id": channel_id})
    if not channel:
        return {"channel": None, "message": "Channel not found"}
    
    member_count = db.channel_members.count_documents({"channel_id": channel_id})
    
    return {
        "channel": {
            "channel_id": channel["id"],
            "name": channel.get("name", ""),
            "description": channel.get("description", ""),
            "is_private": channel.get("is_private", False),
            "member_count": member_count
        }
    }

def get_channel_members(channel_id: str, scope_channels: List[str]) -> Dict[str, Any]:
    """Get members of a channel."""
    db = db_instance.get_db()
    if db is None:
        return {"members": [], "message": "Database not available"}
    
    if channel_id not in scope_channels:
        return {"members": [], "message": "Channel not accessible"}
    
    memberships = list(db.channel_members.find({"channel_id": channel_id}))
    member_ids = [m["user_id"] for m in memberships]
    
    users = list(db.users.find({"id": {"$in": member_ids}}))
    
    results = []
    for user in users:
        results.append({
            "user_id": user["id"],
            "display_name": user.get("display_name", ""),
            "email": user.get("email", "")
        })
    
    return {"members": results, "count": len(results)}

def get_user_channels(user_id: str, scope_channels: List[str]) -> Dict[str, Any]:
    """Get channels a user belongs to (within requester's scope)."""
    db = db_instance.get_db()
    if db is None:
        return {"channels": [], "message": "Database not available"}
    
    memberships = list(db.channel_members.find({"user_id": user_id}))
    user_channel_ids = [m["channel_id"] for m in memberships]
    
    # Only show channels the requester can also see
    visible_channel_ids = [cid for cid in user_channel_ids if cid in scope_channels]
    
    channels = list(db.channels.find({"id": {"$in": visible_channel_ids}}))
    
    results = []
    for channel in channels:
        results.append({
            "channel_id": channel["id"],
            "name": channel.get("name", ""),
            "is_private": channel.get("is_private", False)
        })
    
    return {"channels": results, "count": len(results)}

def search_glossary(term: str) -> Dict[str, Any]:
    """Search the internal glossary for term definitions."""
    db = db_instance.get_db()
    embedding_model = db_instance.get_embedding_model()
    
    if db is None or embedding_model is None:
        return {"definitions": [], "message": "Database not available"}
    
    # Check if there's a dedicated glossary collection
    if "glossary" in db.list_collection_names():
        # Search glossary collection
        regex_query = {"$regex": term, "$options": "i"}
        results = list(db.glossary.find({
            "$or": [
                {"term": regex_query},
                {"acronym": regex_query}
            ]
        }).limit(5))
        
        definitions = []
        for doc in results:
            definitions.append({
                "term": doc.get("term", doc.get("acronym", "")),
                "definition": doc.get("definition", ""),
                "source": "Internal Glossary"
            })
        return {"definitions": definitions, "count": len(definitions)}
    
    # Fallback: Use vector search on messages
    query_embedding = embedding_model.encode(f"definition of {term}").tolist()
    
    pipeline = [
        {
            "$vectorSearch": {
                "index": VECTOR_INDEX_NAME,
                "path": VECTOR_FIELD_NAME,
                "queryVector": query_embedding,
                "numCandidates": 50,
                "limit": 3
            }
        },
        {
            "$addFields": {
                "relevance_score": {"$meta": "vectorSearchScore"}
            }
        },
        {
            "$project": {
                "text": 1,
                "relevance_score": 1,
                "_id": 0
            }
        }
    ]
    
    results = list(db.messages.aggregate(pipeline))
    
    definitions = []
    for doc in results:
        if doc.get("relevance_score", 0) > 0.5:
            definitions.append({
                "term": term,
                "definition": doc.get("text", ""),
                "source": "Message Context",
                "relevance": doc.get("relevance_score", 0)
            })
    
    return {"definitions": definitions, "count": len(definitions)}

def find_experts_in_db(topic: str, scope_channels: List[str], top_k: int = 5) -> Dict[str, Any]:
    """
    Find experts on a topic using Atlas Vector Search on message_embeddings.
    Aggregates by user to find who has written the most relevant content.
    """
    db = db_instance.get_db()
    embedding_model = db_instance.get_embedding_model()
    
    if db is None or embedding_model is None:
        return {"experts": [], "message": "Database or model not available"}
    
    if not scope_channels:
        return {"experts": [], "message": "No channels in scope"}
    
    # Generate query embedding
    query_embedding = embedding_model.encode(topic).tolist()
    
    # Use Atlas Vector Search and aggregate by author
    pipeline = [
        {
            "$vectorSearch": {
                "index": VECTOR_INDEX_NAME,
                "path": VECTOR_FIELD_NAME,
                "queryVector": query_embedding,
                "numCandidates": 200,
                "limit": 100
            }
        },
        {
            "$addFields": {
                "relevance_score": {"$meta": "vectorSearchScore"}
            }
        },
        # Join with messages to get channel_id and text
        {
            "$lookup": {
                "from": "messages",
                "localField": "message_id",
                "foreignField": "id",
                "as": "message_info"
            }
        },
        {"$unwind": "$message_info"},
        # Filter by scope channels
        {
            "$match": {
                "message_info.channel_id": {"$in": scope_channels}
            }
        },
        # Group by author
        {
            "$group": {
                "_id": "$author_id",
                "max_score": {"$max": "$relevance_score"},
                "avg_score": {"$avg": "$relevance_score"},
                "message_count": {"$sum": 1},
                "sample_messages": {"$push": "$message_info.text"}
            }
        },
        {"$sort": {"max_score": -1}},
        {"$limit": top_k},
        # Join with users for display info
        {
            "$lookup": {
                "from": "users",
                "localField": "_id",
                "foreignField": "id",
                "as": "user_info"
            }
        },
        {
            "$project": {
                "user_id": "$_id",
                "relevance_score": "$max_score",
                "avg_relevance": "$avg_score",
                "message_count": 1,
                "sample_messages": {"$slice": ["$sample_messages", 3]},
                "display_name": {"$ifNull": [{"$arrayElemAt": ["$user_info.display_name", 0]}, "Unknown"]},
                "email": {"$ifNull": [{"$arrayElemAt": ["$user_info.email", 0]}, ""]},
                "_id": 0
            }
        }
    ]
    
    experts = list(db[EMBEDDINGS_COLLECTION].aggregate(pipeline))
    return {"experts": experts, "count": len(experts), "method": "atlas_vector_search"}
