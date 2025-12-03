"""
Real-time Semantic Search API for Slack Messages

Provides instant search results as user types each character.
Uses MongoDB Atlas Vector Search for semantic matching.
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from fastembed import TextEmbedding
from typing import List, Optional, AsyncGenerator
from datetime import datetime
from contextlib import asynccontextmanager
import os
import time

# Prevent semaphore leak warnings from fastembed
os.environ["LOKY_MAX_CPU_COUNT"] = "1"

# Configuration
MONGO_URI = os.getenv("MONGO_URI")
DATABASE_NAME = "connectbest_chat"
VECTOR_INDEX_NAME = "vector_index"
EMBEDDING_FIELD = "embedding"
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")

# Global state
mongo_client = None
db = None
embedding_model = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Initialize and cleanup resources."""
    global mongo_client, db, embedding_model
    
    if not MONGO_URI:
        raise ValueError("MONGO_URI environment variable must be set")
    
    # Connect to MongoDB
    print("🔌 Connecting to MongoDB...")
    mongo_client = MongoClient(MONGO_URI, server_api=ServerApi('1'))
    db = mongo_client[DATABASE_NAME]
    print("✅ MongoDB connected")
    
    # Load embedding model (FastEmbed - lightweight, no torch needed)
    print(f"📦 Loading FastEmbed model: {EMBEDDING_MODEL}...")
    embedding_model = TextEmbedding(model_name=EMBEDDING_MODEL)
    print("✅ FastEmbed model loaded")
    
    yield
    
    # Cleanup
    if mongo_client:
        mongo_client.close()
        print("👋 MongoDB connection closed")


app = FastAPI(
    title="Real-time Semantic Search API",
    description="Instant search as you type using MongoDB Atlas Vector Search",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# MODELS
# =============================================================================

class SearchResult(BaseModel):
    message_id: str
    text: str
    author_name: str
    channel_name: str
    created_at: str
    score: float


class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]
    count: int
    search_time_ms: float


# =============================================================================
# HELPERS
# =============================================================================

def get_user_id(username: str) -> Optional[str]:
    """Get user ID from username or display name."""
    user = db.users.find_one({
        "$or": [
            {"username": username},
            {"display_name": username}
        ]
    })
    return user["id"] if user else None


def get_user_channels(user_id: str) -> List[str]:
    """Get list of channel IDs the user has access to."""
    memberships = db.channel_members.find({"user_id": user_id})
    return [m["channel_id"] for m in memberships]


def search_messages(query: str, channel_ids: List[str], limit: int = 10) -> List[dict]:
    """
    Perform vector search on message_embeddings collection.
    Returns matching messages with author and channel info.
    
    Note: message_embeddings doesn't have channel_id, so we join with messages first
    then filter by channel access.
    """
    if not query.strip():
        return []
    
    # Generate embedding for query (FastEmbed returns generator)
    query_embedding = list(embedding_model.embed([query]))[0].tolist()
    
    # Vector search pipeline - join with messages first to get channel_id
    pipeline = [
        {
            "$vectorSearch": {
                "index": VECTOR_INDEX_NAME,
                "path": EMBEDDING_FIELD,
                "queryVector": query_embedding,
                "numCandidates": 200,
                "limit": 100  # Get more to filter by channel
            }
        },
        {
            "$addFields": {
                "score": {"$meta": "vectorSearchScore"}
            }
        },
        # Join with messages to get text and channel_id
        {
            "$lookup": {
                "from": "messages",
                "localField": "message_id",
                "foreignField": "id",
                "as": "msg"
            }
        },
        {"$unwind": "$msg"},
        # Filter by user's accessible channels (using msg.channel_id)
        {
            "$match": {
                "msg.channel_id": {"$in": channel_ids}
            }
        },
        # Join with users to get author name
        {
            "$lookup": {
                "from": "users",
                "localField": "msg.author_id",
                "foreignField": "id",
                "as": "author"
            }
        },
        # Join with channels to get channel name
        {
            "$lookup": {
                "from": "channels",
                "localField": "msg.channel_id",
                "foreignField": "id",
                "as": "channel"
            }
        },
        # Project final shape
        {
            "$project": {
                "_id": 0,
                "message_id": 1,
                "text": "$msg.text",
                "author_name": {"$ifNull": [{"$arrayElemAt": ["$author.display_name", 0]}, "Unknown"]},
                "channel_name": {"$ifNull": [{"$arrayElemAt": ["$channel.name", 0]}, "Unknown"]},
                "created_at": "$msg.created_at",
                "score": 1
            }
        },
        {"$limit": limit}
    ]
    
    results = list(db.message_embeddings.aggregate(pipeline))
    
    # Format dates
    for r in results:
        if isinstance(r.get("created_at"), datetime):
            r["created_at"] = r["created_at"].isoformat()
        else:
            r["created_at"] = str(r.get("created_at", ""))
    
    return results


# =============================================================================
# ENDPOINTS
# =============================================================================

@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "semantic-search",
        "database": "connected" if db is not None else "disconnected",
        "model": EMBEDDING_MODEL
    }


@app.get("/api/semantic-search", response_model=SearchResponse)
async def semantic_search(
    q: str = Query(..., min_length=1, description="Search query"),
    username: str = Query(..., description="Username for access control"),
    limit: int = Query(10, ge=1, le=50, description="Max results")
):
    """
    Semantic search endpoint - call on every keystroke for typeahead.
    GET method only for efficient caching and CDN support.
    """
    import time
    start = time.time()
    
    # Get user and their channels
    user_id = get_user_id(username)
    if not user_id:
        raise HTTPException(status_code=404, detail=f"User '{username}' not found")
    
    channel_ids = get_user_channels(user_id)
    if not channel_ids:
        raise HTTPException(status_code=404, detail="User has no channel access")
    
    # Perform search
    results = search_messages(q, channel_ids, limit)
    
    search_time = (time.time() - start) * 1000
    
    return SearchResponse(
        query=q,
        results=results,
        count=len(results),
        search_time_ms=round(search_time, 2)
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
