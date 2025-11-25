from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from groq import Groq
from typing import List, Optional
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="ConnectBest Summarizer Agent",
    description="Agent for summarizing conversations",
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
groq_client = None

@app.on_event("startup")
async def startup_event():
    global mongo_client, db, groq_client
    
    mongo_uri = os.getenv("MONGO_URI")
    groq_api_key = os.getenv("GROQ_API_KEY")
    
    if not mongo_uri or not groq_api_key:
        raise ValueError("MONGO_URI and GROQ_API_KEY must be set")
    
    mongo_client = MongoClient(mongo_uri, server_api=ServerApi('1'))
    db = mongo_client["connectbest_chat"]
    
    groq_client = Groq(api_key=groq_api_key)

@app.on_event("shutdown")
async def shutdown_event():
    if mongo_client:
        mongo_client.close()

class SummaryRequest(BaseModel):
    channel_id: str = Field(..., description="ID of the channel to summarize")
    thread_ts: Optional[str] = Field(None, description="Optional thread timestamp to summarize specific thread")
    limit: int = Field(50, description="Number of messages to include in summary context")
    requesting_user_id: str = Field(..., description="ID of the requesting user (for scope check)")

class SummaryResponse(BaseModel):
    summary: str
    message_count: int

async def check_access(user_id: str, channel_id: str) -> bool:
    # Verify user is in the channel
    membership = db.channel_members.find_one({"user_id": user_id, "channel_id": channel_id})
    return membership is not None

@app.post("/api/summarize", response_model=SummaryResponse)
async def summarize_conversation(request: SummaryRequest):
    try:
        # 1. Check Access
        if not await check_access(request.requesting_user_id, request.channel_id):
            raise HTTPException(status_code=403, detail="User not authorized to access this channel")
            
        # 2. Fetch Messages
        query = {"channel_id": request.channel_id}
        if request.thread_ts:
            query["thread_ts"] = request.thread_ts
            
        # Sort by timestamp desc to get latest, then reverse
        messages_cursor = db.messages.find(query).sort("ts", -1).limit(request.limit)
        messages = list(messages_cursor)
        messages.reverse() # Chronological order
        
        if not messages:
            return SummaryResponse(summary="No messages found to summarize.", message_count=0)
            
        # 3. Format Context
        context_lines = []
        for msg in messages:
            # Resolve user name if possible (simple cache or query)
            # For now just use user_id or 'User'
            user_id = msg.get("user", "Unknown")
            text = msg.get("text", "")
            context_lines.append(f"{user_id}: {text}")
            
        context = "\n".join(context_lines)
        
        # 4. Generate Summary
        prompt = f"""
        Summarize the following conversation concisely. Highlight key decisions and action items.
        
        Conversation:
        {context}
        """
        
        completion = groq_client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that summarizes conversations."},
                {"role": "user", "content": prompt}
            ]
        )
        
        summary = completion.choices[0].message.content
        
        return SummaryResponse(
            summary=summary,
            message_count=len(messages)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)
