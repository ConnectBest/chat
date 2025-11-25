from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
import os
import httpx
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="ConnectBest AI Orchestrator",
    description="Central agent for routing user intents to specialized agents",
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

# Configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
SEMANTIC_SEARCH_URL = os.getenv("SEMANTIC_SEARCH_URL", "http://localhost:8001")
MEETING_SCHEDULER_URL = os.getenv("MEETING_SCHEDULER_URL", "http://localhost:8000")
USER_LOOKUP_URL = os.getenv("USER_LOOKUP_URL", "http://localhost:8002")
EXPERT_FINDER_URL = os.getenv("EXPERT_FINDER_URL", "http://localhost:8003") # Placeholder
JARGON_BUSTER_URL = os.getenv("JARGON_BUSTER_URL", "http://localhost:8004") # Placeholder
SUMMARIZER_URL = os.getenv("SUMMARIZER_URL", "http://localhost:8005") # Placeholder

if not GROQ_API_KEY:
    print("WARNING: GROQ_API_KEY not set. Orchestrator will fail.")

groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

class OrchestratorRequest(BaseModel):
    query: str = Field(..., description="User's natural language query")
    user_id: str = Field(..., description="ID of the requesting user")
    username: str = Field(..., description="Username of the requesting user")
    context: Optional[Dict[str, Any]] = Field(default={}, description="Additional context (channel_id, etc.)")

class OrchestratorResponse(BaseModel):
    intent: str
    response: Any
    agent_used: str

SYSTEM_PROMPT = """
You are the Orchestrator for a Slack AI Assistant. Your job is to classify the user's intent and extract relevant parameters.
Available Agents:
1. **semantic_search**: Search for past messages, files, or discussions. (Keywords: search, find, look for, what was said about X)
2. **schedule_meeting**: Schedule a meeting or call. (Keywords: schedule, book, set up meeting, zoom)
3. **user_lookup**: Find user details or email. (Keywords: email of X, who is X, contact info)
4. **expert_finder**: Find an expert on a topic. (Keywords: who knows about X, expert in Y)
5. **jargon_buster**: Explain a term or acronym. (Keywords: what is X, define Y, what does Z mean)
6. **summarize**: Summarize a channel or thread. (Keywords: summarize, recap, what happened, catch me up)
7. **chat**: General chat or greeting. (If no other intent matches)

Output JSON format:
{
    "intent": "agent_name",
    "parameters": { ... extracted parameters ... },
    "reasoning": "Why you chose this agent"
}
"""

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "orchestrator"}

@app.post("/api/orchestrate", response_model=OrchestratorResponse)
async def orchestrate(request: OrchestratorRequest):
    if not groq_client:
        raise HTTPException(status_code=500, detail="Groq client not initialized")

    # 1. Classify Intent using Groq
    try:
        # The prompt for the LLM
        prompt_content = f"User Query: {request.query}\nContext: {request.context}"

        chat_completion = groq_client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": SYSTEM_PROMPT
                },
                {
                    "role": "user",
                    "content": prompt_content,
                }
            ],
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            response_format={"type": "json_object"}
        )
        result = chat_completion.choices[0].message.content
        import json
        parsed_result = json.loads(result)
        intent = parsed_result.get("intent")
        params = parsed_result.get("parameters", {})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Intent classification failed: {str(e)}")

    # 2. Route to Agent
    async with httpx.AsyncClient() as client:
        if intent == "semantic_search":
            # Call Semantic Search API
            # payload = {"query": request.query, "username": request.username, "top_k": 5}
            # resp = await client.post(f"{SEMANTIC_SEARCH_URL}/api/semantic-search", json=payload)
            # return OrchestratorResponse(intent=intent, response=resp.json(), agent_used="semantic_search")
            pass # Placeholder for now

        elif intent == "schedule_meeting":
            # This might need a multi-turn flow or extraction of more details.
            # For now, we'll just pass it through or return the intent for the frontend to handle the form.
            pass 

        # ... Implement other routes ...

    # For now, return the classification so we can verify it works
    return OrchestratorResponse(
        intent=intent,
        response=params,
        agent_used="orchestrator_classifier"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8006)
