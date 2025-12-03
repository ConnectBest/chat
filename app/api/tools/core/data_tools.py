"""
Data Tools - Database operations for ConnectBest AI Agent

Optimized with:
- TTL caching for channel IDs and user maps
- Batch operations to avoid N+1 queries
- Minimal field projections
- Reduced numCandidates for vector search
"""

from typing import List, Dict, Any, Optional
import time

from .db import db_instance
from .config import VECTOR_INDEX_NAME, VECTOR_FIELD_NAME, EMBEDDINGS_COLLECTION, CACHE_TTL_SECONDS


# =============================================================================
# CACHING
# =============================================================================

_channel_cache: Dict[str, Any] = {"ids": [], "timestamp": 0}
_user_cache: Dict[str, Any] = {"map": {}, "timestamp": 0}


def get_cached_channel_ids() -> List[str]:
    """Get all channel IDs with TTL caching"""
    global _channel_cache
    now = time.time()
    
    if now - _channel_cache["timestamp"] < CACHE_TTL_SECONDS and _channel_cache["ids"]:
        return _channel_cache["ids"]
    
    db = db_instance.get_db()
    if db is None:
        return []
    
    ids = [c["id"] for c in db.channels.find({}, {"id": 1})]
    _channel_cache = {"ids": ids, "timestamp": now}
    return ids


def get_cached_user_map() -> Dict[str, str]:
    """Get user_id -> display_name map with TTL caching"""
    global _user_cache
    now = time.time()
    
    if now - _user_cache["timestamp"] < CACHE_TTL_SECONDS and _user_cache["map"]:
        return _user_cache["map"]
    
    db = db_instance.get_db()
    if db is None:
        return {}
    
    user_map = {u["id"]: u.get("display_name", "Unknown") for u in db.users.find({}, {"id": 1, "display_name": 1})}
    _user_cache = {"map": user_map, "timestamp": now}
    return user_map


# =============================================================================
# CHANNEL OPERATIONS
# =============================================================================

def resolve_channel_id(channel_identifier: str, db) -> Optional[str]:
    """Resolve channel name or ID to UUID"""
    if not channel_identifier:
        return None
    
    # Check if it's already a UUID
    if len(channel_identifier) == 36 and '-' in channel_identifier:
        if db.channels.find_one({"id": channel_identifier}):
            return channel_identifier
    
    # Find by name (case-insensitive)
    channel = db.channels.find_one({"name": {"$regex": f"^{channel_identifier}$", "$options": "i"}})
    return channel["id"] if channel else None


def get_user_scope(user_id: str) -> Dict[str, Any]:
    """Get channels and users accessible to a user"""
    try:
        db = db_instance.get_db()
        if db is None:
            return {"channels": [], "user_ids": []}
        
        memberships = list(db.channel_members.find({"user_id": user_id}, {"channel_id": 1}))
        channel_ids = [m["channel_id"] for m in memberships]
        
        if channel_ids:
            channel_members = db.channel_members.find({"channel_id": {"$in": channel_ids}}, {"user_id": 1})
            user_ids = list(set(m["user_id"] for m in channel_members))
        else:
            user_ids = [user_id]
        
        return {"channels": channel_ids, "user_ids": user_ids}
    except Exception as e:
        print(f"Error getting user scope: {e}")
        return {"channels": [], "user_ids": []}


# =============================================================================
# MESSAGE OPERATIONS
# =============================================================================

def fetch_slack_history(channel_id: str, limit: int = 50, thread_ts: str = None) -> Dict[str, Any]:
    """Fetch message history with batch user lookup"""
    db = db_instance.get_db()
    if db is None:
        return {"messages": [], "message": "Database not available"}
    
    query = {"channel_id": channel_id}
    if thread_ts:
        query["parent_id"] = thread_ts
    
    messages = list(db.messages.find(query).sort("created_at", -1).limit(limit))
    messages.reverse()
    
    if not messages:
        return {"messages": [], "count": 0}
    
    # Batch user lookup
    user_map = get_cached_user_map()
    
    results = []
    for msg in messages:
        author_id = msg.get("author_id", "")
        results.append({
            "text": msg.get("text", ""),
            "user_id": author_id,
            "user_name": user_map.get(author_id, "Unknown"),
            "timestamp": msg.get("created_at", ""),
            "thread_ts": msg.get("parent_id")
        })
    
    return {"messages": results, "count": len(results)}


# =============================================================================
# USER OPERATIONS
# =============================================================================

def find_users(search_term: str, scope_user_ids: List[str] = None, limit: int = 10) -> Dict[str, Any]:
    """Find users by name/email with optimized query"""
    db = db_instance.get_db()
    if db is None:
        return {"users": [], "message": "Database not available"}
    
    regex_query = {"$regex": search_term, "$options": "i"}
    user_match = {
        "$or": [
            {"display_name": regex_query},
            {"email": regex_query},
            {"username": regex_query}
        ]
    }
    
    if scope_user_ids:
        user_match["id"] = {"$in": scope_user_ids}
    
    projection = {"id": 1, "display_name": 1, "username": 1, "email": 1, "_id": 0}
    users = list(db.users.find(user_match, projection).limit(limit + 1))
    
    has_more = len(users) > limit
    if has_more:
        users = users[:limit]
    
    results = [{
        "user_id": u.get("id", ""),
        "display_name": u.get("display_name", ""),
        "username": u.get("username", ""),
        "email": u.get("email", "")
    } for u in users]
    
    response = {"users": results, "count": len(results)}
    if has_more:
        response["has_more"] = True
    
    return response


# =============================================================================
# VECTOR SEARCH
# =============================================================================

def search_vector_db(query: str, scope_channels: List[str], top_k: int = 10) -> Dict[str, Any]:
    """Search messages using Atlas Vector Search"""
    try:
        db = db_instance.get_db()
        embedding_model = db_instance.get_embedding_model()
        
        if db is None or embedding_model is None:
            return {"results": [], "message": "Database or model not available", "error": True}
        
        if not scope_channels:
            return {"results": [], "message": "No channels in scope", "count": 0}
        
        # FastEmbed returns generator of embeddings
        query_embedding = list(embedding_model.embed([query]))[0].tolist()
        
        pipeline = [
            {
                "$vectorSearch": {
                    "index": VECTOR_INDEX_NAME,
                    "path": VECTOR_FIELD_NAME,
                    "queryVector": query_embedding,
                    "numCandidates": min(top_k * 10, 100),
                    "limit": min(top_k * 3, 30)
                }
            },
            {"$addFields": {"relevance_score": {"$meta": "vectorSearchScore"}}},
            {"$lookup": {"from": "messages", "localField": "message_id", "foreignField": "id", "as": "msg"}},
            {"$unwind": "$msg"},
            {"$match": {"msg.channel_id": {"$in": scope_channels}}},
            {"$lookup": {"from": "users", "localField": "author_id", "foreignField": "id", "as": "author"}},
            {"$lookup": {"from": "channels", "localField": "msg.channel_id", "foreignField": "id", "as": "channel"}},
            {
                "$project": {
                    "message_id": 1,
                    "text": "$msg.text",
                    "author_id": 1,
                    "author_name": {"$ifNull": [{"$arrayElemAt": ["$author.display_name", 0]}, "Unknown"]},
                    "channel_id": "$msg.channel_id",
                    "channel_name": {"$ifNull": [{"$arrayElemAt": ["$channel.name", 0]}, "Unknown"]},
                    "relevance_score": 1,
                    "_id": 0
                }
            },
            {"$limit": top_k}
        ]
        
        results = list(db[EMBEDDINGS_COLLECTION].aggregate(pipeline))
        return {"results": results, "count": len(results)}
    
    except Exception as e:
        print(f"Vector search error: {e}")
        return {"results": [], "message": f"Search failed: {str(e)}", "error": True}


def find_experts_in_db(topic: str, scope_channels: List[str], top_k: int = 5) -> Dict[str, Any]:
    """Find topic experts using vector search aggregation"""
    db = db_instance.get_db()
    embedding_model = db_instance.get_embedding_model()
    
    if db is None or embedding_model is None:
        return {"experts": [], "message": "Database or model not available"}
    
    if not scope_channels:
        return {"experts": [], "message": "No channels in scope"}
    
    # FastEmbed returns generator of embeddings
    query_embedding = list(embedding_model.embed([topic]))[0].tolist()
    
    # Pipeline uses weighted scoring: avg_score * log(message_count + 1)
    # This balances relevance quality with depth of knowledge
    pipeline = [
        {
            "$vectorSearch": {
                "index": VECTOR_INDEX_NAME,
                "path": VECTOR_FIELD_NAME,
                "queryVector": query_embedding,
                "numCandidates": 150,
                "limit": 100
            }
        },
        {"$addFields": {"relevance_score": {"$meta": "vectorSearchScore"}}},
        # Only keep high-relevance matches (above 0.5 threshold)
        {"$match": {"relevance_score": {"$gte": 0.5}}},
        {"$lookup": {"from": "messages", "localField": "message_id", "foreignField": "id", "as": "msg"}},
        {"$unwind": "$msg"},
        {"$match": {"msg.channel_id": {"$in": scope_channels}}},
        {
            "$group": {
                "_id": "$author_id",
                "avg_score": {"$avg": "$relevance_score"},
                "max_score": {"$max": "$relevance_score"},
                "message_count": {"$sum": 1},
                # Keep top 3 message texts for verification
                "sample_messages": {"$push": {"text": "$msg.text", "score": "$relevance_score"}}
            }
        },
        # Weighted score: avg_score * sqrt(message_count) - rewards quality AND depth
        {
            "$addFields": {
                "expertise_score": {
                    "$multiply": ["$avg_score", {"$sqrt": "$message_count"}]
                }
            }
        },
        {"$sort": {"expertise_score": -1}},
        {"$limit": top_k},
        {"$lookup": {"from": "users", "localField": "_id", "foreignField": "id", "as": "user"}},
        {
            "$project": {
                "user_id": "$_id",
                "expertise_score": 1,
                "avg_relevance": "$avg_score",
                "message_count": 1,
                "display_name": {"$ifNull": [{"$arrayElemAt": ["$user.display_name", 0]}, "Unknown"]},
                "email": {"$ifNull": [{"$arrayElemAt": ["$user.email", 0]}, ""]},
                # Get top 2 sample messages sorted by score
                "sample_messages": {"$slice": [
                    {"$sortArray": {"input": "$sample_messages", "sortBy": {"score": -1}}},
                    2
                ]},
                "_id": 0
            }
        }
    ]
    
    experts = list(db[EMBEDDINGS_COLLECTION].aggregate(pipeline))
    return {"experts": experts, "count": len(experts)}


# =============================================================================
# GLOSSARY
# =============================================================================

def search_glossary(term: str) -> Dict[str, Any]:
    """Search internal glossary for term definitions"""
    db = db_instance.get_db()
    if db is None:
        return {"definitions": [], "message": "Database not available"}
    
    if "glossary" not in db.list_collection_names():
        return {"definitions": [], "message": "No glossary collection"}
    
    regex_query = {"$regex": term, "$options": "i"}
    results = list(db.glossary.find({
        "$or": [{"term": regex_query}, {"acronym": regex_query}]
    }).limit(3))
    
    definitions = [{
        "term": doc.get("term", doc.get("acronym", "")),
        "definition": doc.get("definition", ""),
        "source": "Internal Glossary"
    } for doc in results]
    
    return {"definitions": definitions, "count": len(definitions)}
