from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from typing import Optional, List, AsyncGenerator
from contextlib import asynccontextmanager
import re
import os
from dotenv import load_dotenv

load_dotenv()

# Global variables
mongo_client = None
db = None

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Initialize MongoDB connection on startup."""
    global mongo_client, db
    
    mongo_uri = os.getenv("MONGO_URI")
    if not mongo_uri:
        print("WARNING: MONGO_URI not set")
    else:
        try:
            mongo_client = MongoClient(mongo_uri, server_api=ServerApi('1'))
            db = mongo_client["connectbest_chat"]
            print("✅ Connected to MongoDB")
        except Exception as e:
            print(f"❌ Failed to connect to MongoDB: {e}")
            
    yield
    
    """Close MongoDB connection on shutdown."""
    if mongo_client:
        mongo_client.close()
        print("MongoDB connection closed")

app = FastAPI(
    title="ConnectBest User Lookup Agent",
    description="Agent for finding users with scope and read-only constraints",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class LookupRequest(BaseModel):
    query: str = Field(..., description="Name, email, or partial identifier")
    requesting_user_id: str = Field(..., description="ID of the user making the request (for scope check)")


class UserInfo(BaseModel):
    user_id: str
    display_name: str
    email: str
    email_verified: bool


class LookupResponse(BaseModel):
    users: List[UserInfo]
    count: int


# Helper functions
def get_user_scope(user_id: str) -> List[str]:
    """
    Get the list of channel IDs that the requesting user is part of.
    """
    if db is None:
        return []
    memberships = db.channel_members.find({"user_id": user_id})
    channel_ids = [m["channel_id"] for m in memberships]
    return channel_ids


def find_users_in_scope(query: str, scope_channel_ids: List[str]) -> List[dict]:
    """
    Find users matching query who are also members of the given channels.
    """
    if db is None:
        return []
        
    # 1. Find users matching the query (name or email)
    regex_query = {"$regex": query, "$options": "i"}
    user_match = {
        "$or": [
            {"display_name": regex_query},
            {"username": regex_query},
            {"email": regex_query}
        ]
    }
    
    candidate_users = list(db.users.find(user_match))
    if not candidate_users:
        return []
        
    candidate_ids = [u["id"] for u in candidate_users]
    
    valid_members = db.channel_members.find({
        "user_id": {"$in": candidate_ids},
        "channel_id": {"$in": scope_channel_ids}
    })
    
    valid_user_ids = set(m["user_id"] for m in valid_members)
    
    results = []
    for user in candidate_users:
        if user["id"] in valid_user_ids:
            results.append({
                "user_id": user["id"],
                "display_name": user["display_name"],
                "email": user.get("email", ""),
                "email_verified": user.get("email_verified", False)
            })
            
    return results

@app.get("/")
async def root():
    return {"message": "User Lookup Agent Running"}

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "user-lookup",
        "db_connected": db is not None
    }

@app.post("/api/user-lookup", response_model=LookupResponse)
async def lookup_user(request: LookupRequest):
    """
    Find users based on query, restricted to the requesting user's scope.
    """
    try:
        if db is None:
            raise HTTPException(status_code=503, detail="Database not connected")
            
        # 1. Get Scope
        scope_channels = get_user_scope(request.requesting_user_id)
        if not scope_channels:
            return LookupResponse(users=[], count=0)
            
        # 2. Find Users
        users = find_users_in_scope(request.query, scope_channels)
        
        return LookupResponse(users=users, count=len(users))
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
