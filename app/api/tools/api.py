"""
FastAPI Application for ConnectBest AI Agent

Clean API exposing the LangChain agent with:
- Chat endpoint with memory
- Semantic search endpoint
- Session management endpoints
- Health check
"""

import os
import time
from typing import List, Optional
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import agent and db after env vars are loaded
from core.agent import get_agent, ConnectBestAgent
from core.db import db_instance


# =============================================================================
# LIFESPAN MANAGEMENT
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize agent on startup"""
    try:
        agent = get_agent()
        print(f"✅ ConnectBest Agent API ready")
        print(f"   Tools: {len(agent.tools)}")
        yield
    except Exception as e:
        print(f"❌ Failed to initialize agent: {e}")
        raise
    finally:
        print("👋 Shutting down agent API")


# =============================================================================
# FASTAPI APPLICATION
# =============================================================================

app = FastAPI(
    title="ConnectBest AI Agent API",
    description="""
    AI-powered Slack assistant with:
    - Semantic search across messages
    - Expert finder
    - Jargon explanation
    - Channel summarization
    - Meeting scheduling
    - User lookup
    
    All conversations are persisted with 24-hour memory per user.
    """,
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


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class ChatRequest(BaseModel):
    """Chat request payload"""
    message: str = Field(..., description="The user's message", min_length=1)
    user_id: str = Field(..., description="Unique user identifier", min_length=1)
    include_history: bool = Field(True, description="Include conversation history")
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "message": "Who is Alice and what does she work on?",
                "user_id": "user-123",
                "include_history": True
            }
        }
    }


class ChatResponse(BaseModel):
    """Chat response payload"""
    response: str = Field(..., description="The agent's response")
    session_id: str = Field(..., description="Session identifier")
    user_id: str = Field(..., description="User identifier")
    message_count: int = Field(..., description="Total messages in session")


class SessionInfo(BaseModel):
    """Session information"""
    session_id: str
    created_at: str
    updated_at: str
    message_count: int


class MessageInfo(BaseModel):
    """Message in session history"""
    role: str
    content: str
    timestamp: Optional[str] = None


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    service: str
    tools: int
    langsmith_enabled: bool


# =============================================================================
# API ENDPOINTS
# =============================================================================

@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Check API health and configuration"""
    agent = get_agent()
    langsmith_enabled = bool(os.getenv("LANGSMITH_API_KEY"))
    
    return HealthResponse(
        status="healthy",
        service="connectbest-agent",
        tools=len(agent.tools),
        langsmith_enabled=langsmith_enabled
    )


@app.post("/chat", response_model=ChatResponse, tags=["Chat"])
async def chat(request: ChatRequest):
    """
    Chat with the AI agent.
    
    The agent has access to:
    - **semantic_search**: Search past Slack messages
    - **find_experts**: Find topic experts
    - **explain_jargon**: Explain acronyms and terms
    - **summarize_channel**: Summarize channel conversations
    - **schedule_meeting**: Schedule Zoom meetings (just provide a name!)
    - **find_user**: Look up colleagues
    
    Conversation history is automatically maintained per user_id (24h TTL).
    """
    try:
        agent = get_agent()
        result = await agent.chat(
            message=request.message,
            user_id=request.user_id,
            include_history=request.include_history
        )
        
        return ChatResponse(
            response=result["response"],
            session_id=result["session_id"],
            user_id=result["user_id"],
            message_count=result["message_count"]
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/sessions/{user_id}", response_model=List[SessionInfo], tags=["Sessions"])
async def get_user_sessions(user_id: str):
    """Get all sessions for a user"""
    try:
        agent = get_agent()
        sessions = agent.memory.get_user_sessions(user_id)
        
        return [
            SessionInfo(
                session_id=s["session_id"],
                created_at=s["created_at"].isoformat() if s.get("created_at") else "",
                updated_at=s["updated_at"].isoformat() if s.get("updated_at") else "",
                message_count=s.get("message_count", 0)
            )
            for s in sessions
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/sessions/{session_id}/messages", response_model=List[MessageInfo], tags=["Sessions"])
async def get_session_messages(session_id: str):
    """Get all messages in a session"""
    try:
        agent = get_agent()
        messages = agent.get_session_history(session_id)
        
        return [
            MessageInfo(
                role=m["role"],
                content=m["content"],
                timestamp=m["timestamp"].isoformat() if m.get("timestamp") else None
            )
            for m in messages
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/sessions/{session_id}", tags=["Sessions"])
async def delete_session(session_id: str):
    """Delete a specific session"""
    try:
        agent = get_agent()
        deleted = agent.clear_session(session_id)
        
        if deleted:
            return {"status": "deleted", "session_id": session_id}
        else:
            raise HTTPException(status_code=404, detail="Session not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/users/{user_id}/sessions", tags=["Sessions"])
async def delete_user_sessions(user_id: str):
    """Delete all sessions for a user"""
    try:
        agent = get_agent()
        count = agent.clear_user_history(user_id)
        
        return {"status": "deleted", "user_id": user_id, "sessions_deleted": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/tools", tags=["Info"])
async def list_tools():
    """List all available tools"""
    agent = get_agent()
    
    tools_info = []
    for tool in agent.tools:
        tools_info.append({
            "name": tool.name,
            "description": tool.description,
            "parameters": tool.args_schema.model_json_schema() if tool.args_schema else {}
        })
    
    return {"tools": tools_info, "count": len(tools_info)}


# =============================================================================
# SEMANTIC SEARCH ENDPOINTS
# =============================================================================

class SearchResult(BaseModel):
    """Single search result"""
    message_id: str
    text: str
    author_name: str
    channel_name: str
    created_at: str
    score: float


class SearchResponse(BaseModel):
    """Semantic search response"""
    query: str
    results: List[SearchResult]
    count: int
    search_time_ms: float


def get_user_id_by_username(username: str) -> Optional[str]:
    """Get user ID from username or display name"""
    db = db_instance.get_db()
    if not db:
        return None
    user = db.users.find_one({
        "$or": [
            {"username": username},
            {"display_name": username}
        ]
    })
    return user["id"] if user else None


def get_user_channels(user_id: str) -> List[str]:
    """Get list of channel IDs the user has access to"""
    db = db_instance.get_db()
    if not db:
        return []
    memberships = db.channel_members.find({"user_id": user_id})
    return [m["channel_id"] for m in memberships]


def perform_semantic_search(query: str, channel_ids: List[str], limit: int = 10) -> List[dict]:
    """Perform vector search on message_embeddings collection"""
    if not query.strip():
        return []
    
    db = db_instance.get_db()
    embedding_model = db_instance.get_embedding_model()
    
    if not db or not embedding_model:
        return []
    
    # FastEmbed returns generator of embeddings
    query_embedding = list(embedding_model.embed([query]))[0].tolist()
    
    pipeline = [
        {
            "$vectorSearch": {
                "index": "vector_index",
                "path": "embedding",
                "queryVector": query_embedding,
                "numCandidates": 200,
                "limit": 100
            }
        },
        {"$addFields": {"score": {"$meta": "vectorSearchScore"}}},
        {
            "$lookup": {
                "from": "messages",
                "localField": "message_id",
                "foreignField": "id",
                "as": "msg"
            }
        },
        {"$unwind": "$msg"},
        {"$match": {"msg.channel_id": {"$in": channel_ids}}},
        {
            "$lookup": {
                "from": "users",
                "localField": "msg.author_id",
                "foreignField": "id",
                "as": "author"
            }
        },
        {
            "$lookup": {
                "from": "channels",
                "localField": "msg.channel_id",
                "foreignField": "id",
                "as": "channel"
            }
        },
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
    
    for r in results:
        if isinstance(r.get("created_at"), datetime):
            r["created_at"] = r["created_at"].isoformat()
        else:
            r["created_at"] = str(r.get("created_at", ""))
    
    return results


@app.get("/api/semantic-search", response_model=SearchResponse, tags=["Search"])
async def semantic_search(
    q: str = Query(..., min_length=1, description="Search query"),
    username: str = Query(..., description="Username for access control"),
    limit: int = Query(10, ge=1, le=50, description="Max results")
):
    """
    Semantic search endpoint - call on every keystroke for typeahead.
    
    Returns messages semantically similar to the query, filtered by user's channel access.
    """
    start = time.time()
    
    user_id = get_user_id_by_username(username)
    if not user_id:
        raise HTTPException(status_code=404, detail=f"User '{username}' not found")
    
    channel_ids = get_user_channels(user_id)
    if not channel_ids:
        raise HTTPException(status_code=404, detail="User has no channel access")
    
    results = perform_semantic_search(q, channel_ids, limit)
    search_time = (time.time() - start) * 1000
    
    return SearchResponse(
        query=q,
        results=results,
        count=len(results),
        search_time_ms=round(search_time, 2)
    )


# =============================================================================
# RUN SERVER
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", "8001"))
    host = os.getenv("HOST", "0.0.0.0")
    
    print(f"🚀 Starting ConnectBest Agent API on {host}:{port}")
    uvicorn.run(app, host=host, port=port)
