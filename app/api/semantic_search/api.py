from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from sentence_transformers import SentenceTransformer
from typing import List, Optional
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="ConnectBest Semantic Search API",
    description="Semantic search API using Pinecone",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables
mongo_client = None
db = None
embedding_model = None

# MongoDB Atlas Vector Search Configuration
VECTOR_INDEX_NAME = "vector_index"
VECTOR_FIELD_NAME = "embedding"

@app.on_event("startup")
async def startup_event():
    """Initialize connections on startup."""
    global mongo_client, db, embedding_model
    
    mongo_uri = os.getenv("MONGO_URI")
    
    if not mongo_uri:
        raise ValueError("MONGO_URI must be set")
    
    # Connect to MongoDB
    mongo_client = MongoClient(mongo_uri, server_api=ServerApi('1'))
    db = mongo_client["connectbest_chat"]
    
    # Load embedding model
    print("Loading SentenceTransformer model...")
    embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
    print("Model loaded successfully.")


@app.on_event("shutdown")
async def shutdown_event():
    """Close connections on shutdown."""
    if mongo_client:
        mongo_client.close()


# Pydantic models
class SearchRequest(BaseModel):
    username: str = Field(..., description="Username or display name of the user")
    query: str = Field(..., description="Natural language search query", min_length=1)
    top_k: int = Field(5, description="Number of top results to return", ge=1, le=50)


class MessageResult(BaseModel):
    message_id: str
    text: str
    created_at: str
    author_name: str
    channel_name: str
    similarity_score: float


class SearchResponse(BaseModel):
    username: str
    query: str
    accessible_channels: int
    total_messages_searched: int # Approximate
    results: List[MessageResult]
    top_k: int


# Helper functions
def get_user_id_by_name(username: str) -> Optional[str]:
    """Get user ID by username or display name."""
    user = db.users.find_one({
        "$or": [
            {"username": username},
            {"display_name": username}
        ]
    })
    return user["id"] if user else None


# API Endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "backend": "mongodb_atlas_vector_search",
        "model": "all-MiniLM-L6-v2"
    }


@app.post("/api/semantic-search", response_model=SearchResponse)
async def semantic_search(request: SearchRequest):
    """
    Perform semantic search using Pinecone.
    """
    try:
        # Get user ID
        user_id = get_user_id_by_name(request.username)
        if not user_id:
            raise HTTPException(
                status_code=404,
                detail=f"User '{request.username}' not found"
            )
        
        # Get all channels the user is a member of
        user_channels = db.channel_members.find({"user_id": user_id})
        channel_ids = [member["channel_id"] for member in user_channels]
        
        if not channel_ids:
            raise HTTPException(
                status_code=404,
                detail=f"User '{request.username}' is not a member of any channels"
            )
        
        # Generate query embedding
        query_embedding = embedding_model.encode(request.query).tolist()
        
        # MongoDB Atlas Vector Search aggregation pipeline
        pipeline = [
            {
                "$vectorSearch": {
                    "index": VECTOR_INDEX_NAME,
                    "path": VECTOR_FIELD_NAME,
                    "queryVector": query_embedding,
                    "numCandidates": request.top_k * 10,  # Overrequest for better results
                    "limit": request.top_k,
                    "filter": {
                        "channel_id": {"$in": channel_ids}
                    }
                }
            },
            {
                "$addFields": {
                    "similarity_score": {"$meta": "vectorSearchScore"}
                }
            },
            {
                "$lookup": {
                    "from": "users",
                    "localField": "author_id",
                    "foreignField": "id",
                    "as": "author_info"
                }
            },
            {
                "$lookup": {
                    "from": "channels",
                    "localField": "channel_id",
                    "foreignField": "id",
                    "as": "channel_info"
                }
            },
            {
                "$project": {
                    "message_id": "$id",
                    "text": 1,
                    "created_at": 1,
                    "author_name": {
                        "$ifNull": [
                            {"$arrayElemAt": ["$author_info.display_name", 0]},
                            "Unknown"
                        ]
                    },
                    "channel_name": {
                        "$ifNull": [
                            {"$arrayElemAt": ["$channel_info.name", 0]},
                            "Unknown"
                        ]
                    },
                    "similarity_score": 1,
                    "_id": 0
                }
            }
        ]
        
        # Execute aggregation pipeline
        search_results = list(db.messages.aggregate(pipeline))
        
        results = []
        for doc in search_results:
            results.append({
                "message_id": doc.get('message_id', ''),
                "text": doc.get('text', ''),
                "created_at": doc.get('created_at', ''),
                "author_name": doc.get('author_name', 'Unknown'),
                "channel_name": doc.get('channel_name', 'Unknown'),
                "similarity_score": doc.get('similarity_score', 0.0)
            })
        
        return SearchResponse(
            username=request.username,
            query=request.query,
            accessible_channels=len(channel_ids),
            total_messages_searched=1000, # Placeholder, Pinecone doesn't give total scanned easily
            results=results,
            top_k=request.top_k
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
