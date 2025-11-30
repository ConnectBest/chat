"""
Single Agent - The Central Intelligence

This agent directly executes tools for meeting scheduling, expert finding, 
summarization, jargon busting, and data access.

FIXED ISSUES:
- Changed relative imports to absolute imports for standalone execution
- Fixed AgentResponse model to match main.py expectations (agent_used vs tool_used)
- Added find_experts as separate intent from semantic_search
- Improved error detection logic
- Added proper initialization and health checks
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List, AsyncGenerator
from contextlib import asynccontextmanager
import os
import sys
import json
import time
import asyncio

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from groq import Groq
from dotenv import load_dotenv

load_dotenv()

# =============================================================================
# GLOBAL STATE
# =============================================================================
groq_client = None
db_initialized = False
_core_modules = None


# =============================================================================
# LAZY IMPORT CORE MODULES (after path setup)
# =============================================================================
def get_core_modules():
    """Lazy import core modules to avoid circular imports."""
    global _core_modules
    
    if _core_modules is not None:
        return _core_modules
    
    try:
        from core.meeting_tools import schedule_meeting_tool
        from core.expert_tools import find_experts_tool
        from core.summarizer_tools import summarize_tool, summarize_all_channels_stream
        from core.jargon_tools import jargon_buster_tool
        from core.data_tools import search_vector_db, find_users, get_user_scope
        from core.db import db_instance
        
        _core_modules = {
            "schedule_meeting_tool": schedule_meeting_tool,
            "find_experts_tool": find_experts_tool,
            "summarize_tool": summarize_tool,
            "summarize_all_channels_stream": summarize_all_channels_stream,
            "jargon_buster_tool": jargon_buster_tool,
            "search_vector_db": search_vector_db,
            "find_users": find_users,
            "get_user_scope": get_user_scope,
            "db_instance": db_instance
        }
        return _core_modules
    except ImportError as e:
        print(f"⚠️  Failed to import core modules: {e}")
        return None


# =============================================================================
# LIFESPAN MANAGEMENT
# =============================================================================
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Initialize connections on startup."""
    global groq_client, db_initialized
    
    # Initialize Groq client
    groq_api_key = os.getenv("GROQ_API_KEY")
    if groq_api_key:
        groq_client = Groq(api_key=groq_api_key)
        print("✅ Single Agent: Groq client initialized")
    else:
        print("⚠️  Single Agent: GROQ_API_KEY not set")
    
    # Initialize database singleton
    try:
        modules = get_core_modules()
        if modules and modules.get("db_instance"):
            modules["db_instance"].initialize()
            db_initialized = True
            print("✅ Single Agent: Database initialized")
        else:
            print("⚠️  Single Agent: Core modules not available")
    except Exception as e:
        print(f"⚠️  Single Agent: Database init failed: {e}")
        db_initialized = False
    
    yield
    
    print("Single Agent: Shutting down")


app = FastAPI(
    title="ConnectBest Single Agent",
    description="Central agent executing all tools directly",
    version="3.0.0",
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
class AgentRequest(BaseModel):
    query: str = Field(..., description="User's natural language query")
    user_id: str = Field(..., description="ID of the requesting user")
    username: str = Field(..., description="Username of the requesting user")
    context: Optional[Dict[str, Any]] = Field(default={}, description="Additional context (channel_id, thread_ts, etc.)")


class AgentResponse(BaseModel):
    """Response model - uses 'agent_used' to match main.py expectations."""
    success: bool
    intent: str
    response: Any
    agent_used: str  # Fixed: was 'tool_used', main.py expects 'agent_used'
    execution_time: Optional[float] = None
    message: str = ""


# =============================================================================
# INTENT CLASSIFICATION & TOOL SELECTION
# =============================================================================

SYSTEM_PROMPT = """
You are the Single Agent for a Slack AI Assistant. Your job is to classify the user's intent and extract relevant parameters for the available tools.

Available Tools:
1. **schedule_meeting**: Schedule a meeting or call.
   - Keywords: schedule, book, set up meeting, zoom, calendar, invite, arrange, meet with
   - Extract:
     - participant_names: list of names mentioned (e.g., ["Bob", "Alice"])
     - participant_emails: list of email addresses found in the query (e.g., ["user@example.com"])
     - topic: meeting topic (optional, use a reasonable default like "Quick Sync" if not specified)
     - start_time: ISO 8601 format (optional, if not specified leave empty)
     - duration_minutes: meeting duration (default 60)
   - IMPORTANT: Extract ALL email addresses from the query into participant_emails list
   
2. **find_experts**: Find experts or people with specific skills.
   - Keywords: who knows about, expert in, find someone who, who can help with, specialist
   - Extract: topic, top_k (default 3)
   
3. **summarize**: Summarize a channel, thread, or conversation.
   - Keywords: summarize, recap, what happened, catch me up, summary, TLDR
   - Extract: channel_id, thread_ts, limit
   - IMPORTANT: If user asks for "all channels", "all my channels", "all slack channels", or similar, set channel_id to "all"
   - If a specific channel is mentioned, use that channel name as channel_id
   - If no channel specified and not asking for all, use channel_id from context
   
4. **jargon_buster**: Explain internal terms, acronyms, or jargon.
   - Keywords: what is, what does X mean, define, explain the term, what's the meaning
   - Extract: term, context (optional)
   
5. **semantic_search**: Search for past messages, files, or discussions.
   - Keywords: search, find messages, look for, what was said about, search for
   - Extract: query, top_k (default 5)
   
6. **chat**: General conversation, greetings, or unclear intent.
   - Use when no other intent clearly matches
   - Also use for: help, hello, thank you, general questions about capabilities

Output ONLY valid JSON in this format:
{
    "intent": "tool_name",
    "parameters": {
        "key": "extracted_value"
    },
    "confidence": 0.0 to 1.0,
    "reasoning": "Brief explanation"
}

IMPORTANT:
- For find_experts, extract the TOPIC the user wants expertise on
- For jargon_buster, extract the TERM being asked about
- For summarize: if user mentions "all channels", "all my channels", "every channel", "all slack channels" -> set channel_id to "all"
- For summarize: use channel_id from context only if no channel is mentioned in the query
- For schedule_meeting: ALWAYS extract email addresses into participant_emails list
- For schedule_meeting: topic and start_time are OPTIONAL - extract if provided, leave empty if not
- Always include confidence score
"""


async def classify_intent(query: str, context: Dict[str, Any]) -> Dict[str, Any]:
    """Use LLM to classify user intent and extract parameters."""
    if not groq_client:
        raise HTTPException(status_code=503, detail="LLM client not initialized")
    
    try:
        prompt = f"User Query: {query}\nContext: {json.dumps(context)}"
        
        completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            response_format={"type": "json_object"},
            temperature=0.3  # Lower temperature for more consistent classification
        )
        
        result = json.loads(completion.choices[0].message.content)
        return result
    
    except json.JSONDecodeError as e:
        print(f"JSON parsing error: {e}")
        return {
            "intent": "chat",
            "parameters": {},
            "confidence": 0.5,
            "reasoning": "Failed to parse LLM response as JSON"
        }
    except Exception as e:
        print(f"Intent classification error: {e}")
        return {
            "intent": "chat",
            "parameters": {},
            "confidence": 0.5,
            "reasoning": f"Classification failed: {str(e)}"
        }


# =============================================================================
# CHAT HANDLER
# =============================================================================

async def handle_chat(query: str, username: str) -> Dict[str, Any]:
    """Handle general chat/conversation."""
    if not groq_client:
        return {"message": "I'm having trouble connecting to my brain. Please try again later."}
    
    try:
        completion = groq_client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": f"""You are a friendly Slack AI assistant for ConnectBest. 
                    The user's name is {username}.
                    You can help with:
                    - Scheduling meetings (say "schedule a meeting with...")
                    - Finding experts (say "who knows about...")
                    - Summarizing channels (say "summarize #channel-name")
                    - Explaining jargon (say "what does X mean?")
                    - Searching messages (say "search for...")
                    Keep responses concise and helpful."""
                },
                {"role": "user", "content": query}
            ],
            model="meta-llama/llama-4-scout-17b-16e-instruct"
        )
        
        return {"message": completion.choices[0].message.content}
    
    except Exception as e:
        return {"message": f"Sorry, I encountered an error: {str(e)}"}


# =============================================================================
# TOOL EXECUTORS
# =============================================================================

async def execute_tool(intent: str, params: Dict[str, Any], user_id: str, context: Dict[str, Any]) -> Dict[str, Any]:
    """Execute the selected tool directly."""
    
    # Lazy import to avoid circular imports
    modules = get_core_modules()
    
    if modules is None:
        return {"error": "Core modules not available. Database may not be connected."}
    
    try:
        if intent == "schedule_meeting":
            from datetime import datetime, timedelta
            import re
            
            # Extract any email addresses from the original query that LLM might have missed
            email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
            query_emails = re.findall(email_pattern, context.get("original_query", ""))
            
            # Combine LLM-extracted emails with regex-extracted emails
            all_emails = list(set(params.get("participant_emails", []) + query_emails))
            
            # Check if we have participants (names OR emails)
            has_participants = bool(params.get("participant_names") or all_emails)
            
            if not has_participants:
                return {
                    "status": "needs_input",
                    "message": "Who would you like to meet with? Please provide names or email addresses.",
                    "missing_fields": ["participants"]
                }
            
            # Default topic if not provided
            topic = params.get("topic") or "Quick Sync"
            
            # Default start_time to NOW + 5 minutes if not provided
            start_time = params.get("start_time")
            if not start_time:
                start_time = (datetime.utcnow() + timedelta(minutes=5)).strftime("%Y-%m-%dT%H:%M:%S")
                print(f"⏰ No start_time provided, defaulting to: {start_time}")
            
            return modules["schedule_meeting_tool"](
                topic=topic,
                start_time=start_time,
                duration_minutes=params.get("duration_minutes", 60),
                requesting_user_id=user_id,
                participant_emails=all_emails,
                participant_names=params.get("participant_names", [])
            )

        elif intent == "find_experts":
            topic = params.get("topic", "")
            if not topic:
                return {
                    "status": "needs_input",
                    "message": "What topic would you like to find experts on?"
                }
            
            return modules["find_experts_tool"](
                topic=topic,
                requesting_user_id=user_id,
                top_k=params.get("top_k", 3)
            )

        elif intent == "summarize":
            import re
            channel_id = params.get("channel_id") or context.get("channel_id")
            original_query = context.get("original_query", "").lower()
            
            # Detect "all channels" patterns in the original query as fallback
            all_channels_patterns = [
                r'\ball\s+(my\s+)?channels?\b',
                r'\ball\s+(the\s+)?slack\s+channels?\b',
                r'\bevery\s+channel\b',
                r'\ball\s+of\s+(my\s+)?channels?\b',
            ]
            
            is_all_channels = any(re.search(p, original_query) for p in all_channels_patterns)
            
            if is_all_channels or (channel_id and channel_id.lower() in ['all', 'all_channels', 'all channels']):
                channel_id = 'all'
            
            if not channel_id:
                return {
                    "status": "needs_input",
                    "message": "Which channel would you like me to summarize? Please specify the channel name or ID, or say 'all channels'."
                }
            
            return modules["summarize_tool"](
                channel_id=channel_id,
                requesting_user_id=user_id,
                limit=params.get("limit", 50),
                thread_ts=params.get("thread_ts") or context.get("thread_ts")
            )

        elif intent == "jargon_buster":
            term = params.get("term", "")
            if not term:
                return {
                    "status": "needs_input",
                    "message": "What term would you like me to explain?"
                }
            
            return modules["jargon_buster_tool"](
                term=term,
                context=params.get("context", ""),
                requesting_user_id=user_id
            )

        elif intent == "semantic_search":
            query = params.get("query", "")
            if not query:
                return {
                    "status": "needs_input",
                    "message": "What would you like me to search for?"
                }
            
            # Get scope
            scope = modules["get_user_scope"](user_id)
            scope_channels = scope.get("channels", [])
            
            if not scope_channels:
                return {
                    "success": False,
                    "message": "You don't have access to any channels to search."
                }
            
            return modules["search_vector_db"](
                query=query,
                scope_channels=scope_channels,
                top_k=params.get("top_k", 5)
            )

        else:
            return {"error": f"Unknown intent: {intent}"}
    
    except Exception as e:
        print(f"Tool execution error for {intent}: {e}")
        return {"error": f"Failed to execute {intent}: {str(e)}"}


# =============================================================================
# API ENDPOINTS
# =============================================================================

@app.get("/")
async def root():
    return {
        "service": "ConnectBest Single Agent",
        "role": "Central Intelligence",
        "version": "3.0.0"
    }


@app.get("/health")
async def health_check():
    modules = get_core_modules()
    db_connected = False
    
    if modules and modules.get("db_instance"):
        db = modules["db_instance"].get_db()
        db_connected = db is not None
    
    return {
        "status": "healthy",
        "service": "single-agent",
        "llm_available": groq_client is not None,
        "db_initialized": db_initialized,
        "db_connected": db_connected
    }


@app.post("/api/orchestrate", response_model=AgentResponse)
async def orchestrate(request: AgentRequest):
    """
    Main orchestration endpoint.
    Classifies intent and executes the appropriate tool directly.
    """
    start_time = time.time()
    
    if not groq_client:
        raise HTTPException(status_code=503, detail="LLM client not initialized")
    
    try:
        # 1. Classify Intent
        classification = await classify_intent(request.query, request.context or {})
        intent = classification.get("intent", "chat")
        params = classification.get("parameters", {})
        confidence = classification.get("confidence", 0.0)
        
        print(f"🎯 Intent: {intent} | Confidence: {confidence} | Params: {params}")
        
        # 2. Execute Tool or Chat
        if intent == "chat":
            response = await handle_chat(request.query, request.username)
            agent_used = "chat"
        else:
            # Pass original query in context for email extraction
            exec_context = dict(request.context or {})
            exec_context["original_query"] = request.query
            response = await execute_tool(intent, params, request.user_id, exec_context)
            agent_used = intent
        
        # 3. Determine success
        # Check multiple conditions for success
        is_success = True
        if isinstance(response, dict):
            if response.get("error"):
                is_success = False
            elif response.get("success") is False:
                is_success = False
            elif response.get("status") == "needs_input":
                is_success = True  # Not a failure, just needs more info
        
        execution_time = round(time.time() - start_time, 3)
        
        # 4. Return Response
        return AgentResponse(
            success=is_success,
            intent=intent,
            response=response,
            agent_used=agent_used,
            execution_time=execution_time,
            message=classification.get("reasoning", "")
        )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Orchestration error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# DIRECT TOOL ENDPOINTS (for testing)
# =============================================================================

@app.post("/api/find-experts")
async def find_experts_endpoint(topic: str, user_id: str, top_k: int = 3):
    """Direct endpoint for finding experts."""
    modules = get_core_modules()
    if not modules:
        raise HTTPException(status_code=503, detail="Core modules not available")
    return modules["find_experts_tool"](topic, user_id, top_k)


@app.post("/api/summarize")
async def summarize_endpoint(channel_id: str, user_id: str, limit: int = 50):
    """Direct endpoint for summarization."""
    modules = get_core_modules()
    if not modules:
        raise HTTPException(status_code=503, detail="Core modules not available")
    return modules["summarize_tool"](channel_id, user_id, limit)


@app.post("/api/jargon")
async def jargon_endpoint(term: str, user_id: str, context: str = ""):
    """Direct endpoint for jargon busting."""
    modules = get_core_modules()
    if not modules:
        raise HTTPException(status_code=503, detail="Core modules not available")
    return modules["jargon_buster_tool"](term, context, user_id)


@app.post("/api/search")
async def search_endpoint(query: str, user_id: str, top_k: int = 5):
    """Direct endpoint for semantic search."""
    modules = get_core_modules()
    if not modules:
        raise HTTPException(status_code=503, detail="Core modules not available")
    scope = modules["get_user_scope"](user_id)
    return modules["search_vector_db"](query, scope.get("channels", []), top_k)


@app.post("/api/orchestrate/stream")
async def orchestrate_stream(request: AgentRequest):
    """
    Streaming orchestration endpoint for real-time progress updates.
    Returns Server-Sent Events (SSE) for operations that support streaming.
    """
    if not groq_client:
        raise HTTPException(status_code=503, detail="LLM client not initialized")
    
    async def event_generator():
        start_time = time.time()
        
        try:
            # Classify Intent
            yield f"data: {json.dumps({'type': 'status', 'message': '🎯 Understanding your request...'})}\n\n"
            await asyncio.sleep(0.1)  # Small delay for client to catch up
            
            classification = await classify_intent(request.query, request.context or {})
            intent = classification.get("intent", "chat")
            params = classification.get("parameters", {})
            
            yield f"data: {json.dumps({'type': 'status', 'message': f'📍 Intent: {intent}'})}\n\n"
            
            # Check if this is an all-channels summarization (streamable)
            if intent == "summarize":
                import re
                channel_id = params.get("channel_id") or (request.context or {}).get("channel_id")
                original_query = request.query.lower()
                
                all_channels_patterns = [
                    r'\ball\s+(my\s+)?channels?\b',
                    r'\ball\s+(the\s+)?slack\s+channels?\b',
                    r'\bevery\s+channel\b',
                    r'\ball\s+of\s+(my\s+)?channels?\b',
                ]
                
                is_all_channels = any(re.search(p, original_query) for p in all_channels_patterns)
                
                if is_all_channels or (channel_id and channel_id.lower() in ['all', 'all_channels', 'all channels']):
                    # Stream all-channels summarization
                    modules = get_core_modules()
                    if not modules:
                        yield f"data: {json.dumps({'type': 'error', 'message': 'Core modules not available'})}\n\n"
                        return
                    
                    scope = modules["get_user_scope"](request.user_id)
                    scope_channels = scope.get("channels", [])
                    
                    if not scope_channels:
                        yield f"data: {json.dumps({'type': 'error', 'message': 'You don\'t have access to any channels'})}\n\n"
                        return
                    
                    # Stream the summarization progress
                    for event in modules["summarize_all_channels_stream"](request.user_id, scope_channels, 20):
                        yield f"data: {json.dumps(event)}\n\n"
                        await asyncio.sleep(0.05)  # Small delay between events
                    
                    execution_time = round(time.time() - start_time, 2)
                    yield f"data: {json.dumps({'type': 'done', 'execution_time': execution_time})}\n\n"
                    return
            
            # For non-streaming intents, execute normally
            yield f"data: {json.dumps({'type': 'status', 'message': '⚙️ Processing your request...'})}\n\n"
            
            if intent == "chat":
                response = await handle_chat(request.query, request.username)
            else:
                exec_context = dict(request.context or {})
                exec_context["original_query"] = request.query
                response = await execute_tool(intent, params, request.user_id, exec_context)
            
            execution_time = round(time.time() - start_time, 2)
            
            yield f"data: {json.dumps({'type': 'complete', 'data': response, 'intent': intent, 'execution_time': execution_time})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8006)
