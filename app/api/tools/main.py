"""
ConnectBest Slack AI Assistant - Main Entry Point

This is the main entry point that connects to Slack using Bolt framework
and routes all events to the Orchestrator Agent.

Architecture:
- Slack Events → This App → Orchestrator → Feature Agents → Response

Features:
- Socket Mode for development
- HTTP Mode for production (AWS)
- App mentions and direct messages handling
- Slash commands support
"""

import os
import logging
from typing import Optional
from dotenv import load_dotenv

# Slack Bolt
from slack_bolt import App
from slack_bolt.adapter.socket_mode import SocketModeHandler

# For HTTP mode (production)
from fastapi import FastAPI, Request
from slack_bolt.adapter.fastapi import SlackRequestHandler

# HTTP client for orchestrator
import httpx

load_dotenv()

# =============================================================================
# CONFIGURATION
# =============================================================================

# Slack credentials
SLACK_BOT_TOKEN = os.getenv("SLACK_BOT_TOKEN")
SLACK_SIGNING_SECRET = os.getenv("SLACK_SIGNING_SECRET")
SLACK_APP_TOKEN = os.getenv("SLACK_APP_TOKEN")  # For Socket Mode

# Orchestrator URL
ORCHESTRATOR_URL = os.getenv("ORCHESTRATOR_URL", "http://localhost:8006")

# Mode: "socket" for development, "http" for production
MODE = os.getenv("SLACK_MODE", "socket")

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# =============================================================================
# SLACK BOLT APP
# =============================================================================

# Validate required env vars
if not SLACK_BOT_TOKEN or not SLACK_SIGNING_SECRET:
    raise ValueError("SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET must be set")

# Initialize Slack app
slack_app = App(
    token=SLACK_BOT_TOKEN,
    signing_secret=SLACK_SIGNING_SECRET
)


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

async def call_orchestrator(
    query: str,
    user_id: str,
    username: str,
    channel_id: Optional[str] = None,
    thread_ts: Optional[str] = None
) -> dict:
    """Call the Orchestrator Agent with a user query."""
    
    payload = {
        "query": query,
        "user_id": user_id,
        "username": username,
        "context": {
            "channel_id": channel_id,
            "thread_ts": thread_ts
        }
    }
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(
                f"{ORCHESTRATOR_URL}/api/orchestrate",
                json=payload
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Orchestrator error: {response.status_code} - {response.text}")
                return {
                    "success": False,
                    "response": {"message": "I'm having trouble processing your request. Please try again."},
                    "agent_used": "error"
                }
        
        except httpx.TimeoutException:
            logger.error("Orchestrator timeout")
            return {
                "success": False,
                "response": {"message": "Request timed out. Please try again."},
                "agent_used": "timeout"
            }
        except Exception as e:
            logger.error(f"Orchestrator call failed: {e}")
            return {
                "success": False,
                "response": {"message": f"Error: {str(e)}"},
                "agent_used": "error"
            }


def format_response(orchestrator_response: dict) -> str:
    """Format the orchestrator response for Slack."""
    
    response_data = orchestrator_response.get("response", {})
    intent = orchestrator_response.get("intent", "")
    agent = orchestrator_response.get("agent_used", "")
    
    # Handle different response types
    if isinstance(response_data, dict):
        # Check for error
        if "error" in response_data:
            return f"❌ {response_data['error']}"
        
        # Check for message (simple response)
        if "message" in response_data and len(response_data) == 1:
            return response_data["message"]
        
        # Expert finder response
        if "experts" in response_data:
            experts = response_data["experts"]
            if not experts:
                return "I couldn't find any experts on that topic in your accessible channels."
            
            lines = ["🎯 *Experts Found:*\n"]
            for i, expert in enumerate(experts, 1):
                name = expert.get("display_name", "Unknown")
                score = expert.get("relevance_score", 0)
                lines.append(f"{i}. *{name}* (relevance: {score:.2f})")
                
                # Show sample messages if available
                samples = expert.get("relevant_messages", expert.get("sample_messages", []))
                if samples:
                    lines.append(f"   _\"{samples[0][:100]}...\"_")
            
            return "\n".join(lines)
        
        # Summarizer response
        if "summary" in response_data:
            return f"📝 *Summary:*\n\n{response_data['summary']}"
        
        # Jargon buster response
        if "explanation" in response_data:
            term = response_data.get("term", "")
            explanation = response_data.get("explanation", "")
            source = response_data.get("source", "")
            return f"📚 *{term}*\n\n{explanation}\n\n_Source: {source}_"
        
        # Search results (Direct results list)
        if "results" in response_data:
            results = response_data["results"]
            if not results:
                return "No results found."
            
            lines = [f"🔍 *Found {len(results)} results:*\n"]
            for r in results[:5]:  # Limit to 5
                text = r.get("text", "")[:150]
                author = r.get("author_name", "Unknown")
                channel = r.get("channel_name", "")
                lines.append(f"• *{author}* in #{channel}:\n  _{text}..._\n")
            
            return "\n".join(lines)

        # Meeting Scheduler response
        if "meeting" in response_data:
            meeting = response_data["meeting"]
            topic = meeting.get("topic", "Meeting")
            join_url = meeting.get("join_url", "#")
            start_time = meeting.get("start_time", "")
            
            return (
                f"📅 *Meeting Scheduled!*\n\n"
                f"*Topic:* {topic}\n"
                f"*Time:* {start_time}\n"
                f"*Link:* {join_url}\n\n"
                f"Invitations have been sent."
            )
        
        # Needs input
        if response_data.get("status") == "needs_input":
            return response_data.get("message", "Please provide more information.")
        
        # Fallback: return as formatted JSON
        import json
        return f"```{json.dumps(response_data, indent=2)}```"
    
    elif isinstance(response_data, str):
        return response_data
    
    else:
        return str(response_data)


def sync_call_orchestrator(query, user_id, username, channel_id, thread_ts):
    """Synchronous wrapper for calling orchestrator."""
    import asyncio
    
    async def _call():
        return await call_orchestrator(query, user_id, username, channel_id, thread_ts)
    
    # Try to get existing event loop, create new one if none exists
    try:
        loop = asyncio.get_running_loop()
        # If we're already in an async context, we need to use run_coroutine_threadsafe
        import concurrent.futures
        future = asyncio.run_coroutine_threadsafe(_call(), loop)
        return future.result(timeout=60)
    except RuntimeError:
        # No running event loop, safe to use asyncio.run()
        return asyncio.run(_call())


# =============================================================================
# SLACK EVENT HANDLERS
# =============================================================================

@slack_app.event("app_mention")
def handle_app_mention(event, say, client):
    """Handle when the bot is @mentioned."""
    
    user_id = event.get("user")
    channel_id = event.get("channel")
    thread_ts = event.get("thread_ts") or event.get("ts")
    text = event.get("text", "")
    
    # Remove the bot mention from the text
    # Format: <@BOT_ID> message
    import re
    query = re.sub(r"<@[A-Z0-9]+>", "", text).strip()
    
    if not query:
        say(
            text="Hi! How can I help you? Try asking me to:\n"
                 "• Find experts: _who knows about Python?_\n"
                 "• Summarize: _summarize this channel_\n"
                 "• Explain jargon: _what does OKR mean?_\n"
                 "• Search: _find messages about the project deadline_",
            thread_ts=thread_ts
        )
        return
    
    # Get user info
    try:
        user_info = client.users_info(user=user_id)
        username = user_info["user"]["real_name"] or user_info["user"]["name"]
    except Exception:
        username = "User"
    
    # Show typing indicator
    say(text="🤔 Thinking...", thread_ts=thread_ts)
    
    # Call orchestrator
    result = sync_call_orchestrator(query, user_id, username, channel_id, thread_ts)
    
    # Format and send response
    response_text = format_response(result)
    
    # Update the "Thinking..." message or send new one
    say(text=response_text, thread_ts=thread_ts)


@slack_app.event("message")
def handle_direct_message(event, say, client):
    """Handle direct messages to the bot."""
    
    # Ignore bot messages
    if event.get("bot_id") or event.get("subtype"):
        return
    
    # Only handle DMs (channel type "im")
    channel_type = event.get("channel_type")
    if channel_type != "im":
        return
    
    user_id = event.get("user")
    channel_id = event.get("channel")
    thread_ts = event.get("thread_ts") or event.get("ts")
    query = event.get("text", "").strip()
    
    if not query:
        return
    
    # Get user info
    try:
        user_info = client.users_info(user=user_id)
        username = user_info["user"]["real_name"] or user_info["user"]["name"]
    except Exception:
        username = "User"
    
    # Call orchestrator
    result = sync_call_orchestrator(query, user_id, username, channel_id, thread_ts)
    
    # Format and send response
    response_text = format_response(result)
    say(text=response_text, thread_ts=thread_ts)


@slack_app.command("/ask")
def handle_ask_command(ack, command, say, client):
    """Handle /ask slash command."""
    ack()
    
    user_id = command.get("user_id")
    channel_id = command.get("channel_id")
    query = command.get("text", "").strip()
    
    if not query:
        say(text="Usage: `/ask <your question>`\n\nExample: `/ask who knows about machine learning?`")
        return
    
    # Get user info
    try:
        user_info = client.users_info(user=user_id)
        username = user_info["user"]["real_name"] or user_info["user"]["name"]
    except Exception:
        username = "User"
    
    # Call orchestrator
    result = sync_call_orchestrator(query, user_id, username, channel_id, None)
    
    # Format and send response
    response_text = format_response(result)
    say(text=response_text)


@slack_app.command("/summarize")
def handle_summarize_command(ack, command, say, client):
    """Handle /summarize slash command."""
    ack()
    
    user_id = command.get("user_id")
    channel_id = command.get("channel_id")
    
    # Get user info
    try:
        user_info = client.users_info(user=user_id)
        username = user_info["user"]["real_name"] or user_info["user"]["name"]
    except Exception:
        username = "User"
    
    # Call orchestrator with summarize intent
    query = f"summarize this channel"
    result = sync_call_orchestrator(query, user_id, username, channel_id, None)
    
    # Format and send response
    response_text = format_response(result)
    say(text=response_text)


@slack_app.command("/expert")
def handle_expert_command(ack, command, say, client):
    """Handle /expert slash command."""
    ack()
    
    user_id = command.get("user_id")
    channel_id = command.get("channel_id")
    topic = command.get("text", "").strip()
    
    if not topic:
        say(text="Usage: `/expert <topic>`\n\nExample: `/expert Python`")
        return
    
    # Get user info
    try:
        user_info = client.users_info(user=user_id)
        username = user_info["user"]["real_name"] or user_info["user"]["name"]
    except Exception:
        username = "User"
    
    # Call orchestrator
    query = f"who knows about {topic}"
    result = sync_call_orchestrator(query, user_id, username, channel_id, None)
    
    # Format and send response
    response_text = format_response(result)
    say(text=response_text)


# =============================================================================
# FASTAPI APP (for HTTP mode / production)
# =============================================================================

api = FastAPI(
    title="ConnectBest Slack Bot",
    description="Slack event handler for multi-agent AI assistant"
)

slack_handler = SlackRequestHandler(slack_app)


@api.get("/")
async def root():
    return {"service": "Slack Bot", "status": "running"}


@api.get("/health")
async def health():
    return {"status": "healthy", "mode": MODE}


@api.post("/slack/events")
async def slack_events(request: Request):
    """Handle Slack events via HTTP."""
    return await slack_handler.handle(request)


@api.post("/slack/commands")
async def slack_commands(request: Request):
    """Handle Slack slash commands via HTTP."""
    return await slack_handler.handle(request)


# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

def main():
    """Start the Slack bot."""
    
    print("=" * 60)
    print("🤖 ConnectBest Slack AI Assistant")
    print("=" * 60)
    print(f"Mode: {MODE}")
    print(f"Orchestrator: {ORCHESTRATOR_URL}")
    print("=" * 60)
    
    if MODE == "socket":
        # Socket Mode for development
        if not SLACK_APP_TOKEN:
            raise ValueError("SLACK_APP_TOKEN required for Socket Mode")
        
        print("Starting in Socket Mode...")
        handler = SocketModeHandler(slack_app, SLACK_APP_TOKEN)
        handler.start()
    
    else:
        # HTTP Mode for production
        import uvicorn
        print("Starting in HTTP Mode...")
        uvicorn.run(api, host="0.0.0.0", port=3000)


if __name__ == "__main__":
    main()
