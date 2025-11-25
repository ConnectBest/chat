from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from sentence_transformers import SentenceTransformer
from typing import List, Optional
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="ConnectBest Expert Finder Agent",
    description="Agent for finding experts based on skills and past messages",
    version="1.0.0"
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
    global mongo_client, db, embedding_model
    
    mongo_uri = os.getenv("MONGO_URI")
    
    if not mongo_uri:
        raise ValueError("MONGO_URI must be set")
    
    mongo_client = MongoClient(mongo_uri, server_api=ServerApi('1'))
    db = mongo_client["connectbest_chat"]
    
    print("Loading SentenceTransformer model...")
    embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
    print("Model loaded successfully.")

@app.on_event("shutdown")
async def shutdown_event():
    if mongo_client:
        mongo_client.close()

class ExpertRequest(BaseModel):
    query: str = Field(..., description="Topic or skill to find experts in")
    requesting_user_id: str = Field(..., description="ID of the requesting user")
    top_k: int = Field(3, description="Number of experts to return")

class ExpertProfile(BaseModel):
    user_id: str
    display_name: str
    email: str
    relevance_score: float
    relevant_messages: List[str]

class ExpertResponse(BaseModel):
    experts: List[ExpertProfile]

async def get_user_scope(user_id: str) -> List[str]:
    """Get list of channel IDs the user has access to."""
    memberships = db.channel_members.find({"user_id": user_id})
    return [m["channel_id"] for m in memberships]

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "backend": "mongodb_atlas_vector_search",
        "model": "all-MiniLM-L6-v2"
    }

@app.post("/api/expert-finder", response_model=ExpertResponse)
async def find_experts(request: ExpertRequest):
    try:
        # 1. Get user's accessible channels
        scope_channels = await get_user_scope(request.requesting_user_id)
        if not scope_channels:
            return ExpertResponse(experts=[])
            
        # 2. Generate query embedding
        query_embedding = embedding_model.encode(request.query).tolist()
        
        # 3. MongoDB Atlas Vector Search aggregation pipeline
        # Strategy: Find experts based on MAXIMUM relevance score (quality over quantity)
        pipeline = [
            {
                "$vectorSearch": {
                    "index": VECTOR_INDEX_NAME,
                    "path": VECTOR_FIELD_NAME,
                    "queryVector": query_embedding,
                    "numCandidates": 100,  # Fetch more candidates for aggregation
                    "limit": 50,  # Get top 50 messages to aggregate by author
                    "filter": {
                        "channel_id": {"$in": scope_channels}
                    }
                }
            },
            {
                "$addFields": {
                    "relevance_score": {"$meta": "vectorSearchScore"}
                }
            },
            {
                "$group": {
                    "_id": "$author_id",
                    "max_score": {"$max": "$relevance_score"},  # Max score strategy
                    "messages": {"$push": "$text"}
                }
            },
            {
                "$sort": {"max_score": -1}
            },
            {
                "$limit": request.top_k
            },
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
                    "relevant_messages": {"$slice": ["$messages", 3]},  # Top 3 messages
                    "display_name": {
                        "$ifNull": [
                            {"$arrayElemAt": ["$user_info.display_name", 0]},
                            "Unknown"
                        ]
                    },
                    "email": {
                        "$ifNull": [
                            {"$arrayElemAt": ["$user_info.email", 0]},
                            ""
                        ]
                    },
                    "_id": 0
                }
            }
        ]
        
        # Execute aggregation pipeline
        expert_results = list(db.messages.aggregate(pipeline))
        
        # Build expert profiles
        experts = []
        for doc in expert_results:
            experts.append(ExpertProfile(
                user_id=doc.get('user_id', ''),
                display_name=doc.get('display_name', 'Unknown'),
                email=doc.get('email', ''),
                relevance_score=doc.get('relevance_score', 0.0),
                relevant_messages=doc.get('relevant_messages', [])
            ))
                
        return ExpertResponse(experts=experts)
        
    except Exception as e:
        print(f"Error in expert_finder: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
