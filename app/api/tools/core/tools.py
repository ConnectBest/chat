"""
LangChain Tools for ConnectBest AI Agent

Clean, optimized tool definitions with Pydantic schemas.
"""

import re
import threading
from datetime import datetime, timedelta
from typing import List, Dict, Any
from pydantic import BaseModel, Field
from langchain_core.tools import StructuredTool

from .config import MAX_USER_RESULTS
from .db import db_instance
from .data_tools import (
    search_vector_db,
    find_users,
    find_experts_in_db,
    resolve_channel_id,
    get_cached_channel_ids
)
from .jargon_tools import jargon_buster_tool
from .summarizer_tools import summarize_tool
from .meeting_tools import schedule_meeting_tool


# =============================================================================
# USER CONTEXT (Thread-local storage for async safety)
# =============================================================================

# Use threading.local() for thread-safe user context
_user_context = threading.local()


def set_current_user(user_id: str):
    """Set current user for tool execution (thread-safe)"""
    _user_context.user_id = user_id


def get_current_user() -> str:
    """Get current user ID (thread-safe)"""
    return getattr(_user_context, 'user_id', '')


# =============================================================================
# INPUT SCHEMAS
# =============================================================================

class SemanticSearchInput(BaseModel):
    query: str = Field(..., description="Search query for Slack messages")
    channel_name: str = Field("", description="Optional: channel name to filter (e.g. 'general')")
    limit: str = Field("10", description="Max results (default: 10)")


class FindExpertsInput(BaseModel):
    topic: str = Field(..., description="Topic to find experts for (e.g. 'python', 'kubernetes')")
    limit: str = Field("5", description="Max experts to return (default: 5)")


class ExplainJargonInput(BaseModel):
    term: str = Field(..., description="Term/acronym to explain (e.g. 'API', 'OKR')")


class SummarizeChannelInput(BaseModel):
    channel_name: str = Field(..., description="Channel to summarize (e.g. 'general') or 'all'")
    message_limit: str = Field("50", description="Number of recent messages (default: 50)")


class ScheduleMeetingInput(BaseModel):
    attendees: str = Field(..., description="Attendee name(s) or email(s), comma-separated for multiple")
    topic: str = Field("Quick Sync", description="Meeting topic (default: 'Quick Sync')")
    duration_minutes: str = Field("30", description="Duration in minutes (default: 30)")
    when: str = Field("now", description="When: 'now', '2pm', 'tomorrow 10am'")
    exclude_me: str = Field("no", description="Set to 'yes' ONLY if user explicitly says 'don't add me' or 'without me'")


class FindUserInput(BaseModel):
    name: str = Field(..., description="Name of colleague to look up")


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _parse_int(value: str, default: int) -> int:
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def _parse_time(when: str) -> datetime:
    """Parse time string to datetime"""
    when = when.lower().strip()
    now = datetime.now()
    
    if when in ["now", "immediately", "asap"]:
        return now + timedelta(minutes=5)
    
    # Check for "tomorrow"
    if "tomorrow" in when:
        now = now + timedelta(days=1)
        when = when.replace("tomorrow", "").strip()
    
    # Parse time like "2pm", "14:00"
    match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(am|pm)?', when)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2) or 0)
        ampm = match.group(3)
        
        if ampm == "pm" and hour < 12:
            hour += 12
        elif ampm == "am" and hour == 12:
            hour = 0
        
        return now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    
    return now + timedelta(minutes=30)


def _is_email(text: str) -> bool:
    return bool(re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', text.strip()))


def _resolve_attendee(attendee: str) -> Dict[str, Any]:
    """Resolve attendee name/email to contact info"""
    attendee = attendee.strip()
    
    if _is_email(attendee):
        result = find_users(attendee, limit=1)
        users = result.get("users", [])
        if users:
            return {"email": users[0].get("email", attendee), "display_name": users[0].get("display_name"), "is_external": False}
        return {"email": attendee, "display_name": attendee.split('@')[0], "is_external": True}
    else:
        result = find_users(attendee, limit=1)
        users = result.get("users", [])
        if users:
            return {"email": users[0].get("email", ""), "display_name": users[0].get("display_name"), "is_external": False}
        return {"email": "", "display_name": attendee, "error": f"User '{attendee}' not found"}


# =============================================================================
# TOOL FUNCTIONS
# =============================================================================

def semantic_search_func(query: str, channel_name: str = "", limit: str = "10") -> str:
    """Search Slack messages semantically"""
    limit_int = _parse_int(limit, 10)
    db = db_instance.get_db()
    scope_channels = get_cached_channel_ids()
    
    if channel_name and db:
        resolved = resolve_channel_id(channel_name, db)
        if resolved:
            scope_channels = [resolved]
        else:
            return f"Channel '{channel_name}' not found"
    
    result = search_vector_db(query, scope_channels, limit_int)
    
    if result.get("error"):
        return result.get("message", "Search failed")
    
    results = result.get("results", [])
    if not results:
        return f"No messages found for '{query}'"
    
    output = f"Found {len(results)} relevant messages:\n\n"
    for i, msg in enumerate(results, 1):
        score = msg.get("relevance_score", 0)
        output += f"{i}. **{msg.get('author_name', 'Unknown')}** in #{msg.get('channel_name', '?')} ({score:.2f})\n"
        output += f"   {msg.get('text', '')[:150]}...\n\n"
    
    return output


def find_experts_func(topic: str, limit: str = "5") -> str:
    """Find experts on a topic"""
    limit_int = _parse_int(limit, 5)
    scope_channels = get_cached_channel_ids()
    result = find_experts_in_db(topic, scope_channels, limit_int)
    
    experts = result.get("experts", [])
    if not experts:
        return f"No experts found for '{topic}'. Try a different search term."
    
    # Build clean output with sample messages for verification
    lines = [f"Top Experts on {topic}:"]
    lines.append("")
    
    for i, exp in enumerate(experts, 1):
        name = exp.get('display_name', 'Unknown')
        email = exp.get('email', '')
        msg_count = exp.get('message_count', 0)
        avg_rel = exp.get('avg_relevance', 0)
        samples = exp.get('sample_messages', [])
        
        # Expert header
        lines.append(f"{i}. {name} ({email})")
        lines.append(f"   {msg_count} relevant messages, {avg_rel:.0%} avg match")
        
        # Sample quotes for verification
        if samples:
            lines.append("   Example quotes:")
            for sample in samples[:2]:
                raw = sample.get('text', '') or ''
                # Clean and truncate
                text = raw[:80].replace('\n', ' ').strip()
                if len(raw) > 80:
                    text += "..."
                if text:
                    lines.append(f"   - {text}")
        lines.append("")
    
    return "\n".join(lines)


def explain_jargon_func(term: str) -> str:
    """Explain a jargon term"""
    result = jargon_buster_tool(term)
    
    if not result.get("success"):
        return result.get("message", f"Could not look up '{term}'")
    
    explanation = result.get("explanation", "")
    source = result.get("source", "General Knowledge")
    found = result.get("found_in_glossary", False)
    
    if found:
        return f"**{term}**\n\n{explanation}\n\n_Source: {source}_"
    else:
        return f"**{term}** is not in the company glossary. Based on general knowledge: {explanation}"


def summarize_channel_func(channel_name: str, message_limit: str = "50") -> str:
    """Summarize channel conversations"""
    limit_int = _parse_int(message_limit, 50)
    user_id = get_current_user()
    
    if not user_id:
        db = db_instance.get_db()
        if db:
            user = db.users.find_one({}, {"id": 1})
            user_id = user.get("id", "") if user else ""
    
    result = summarize_tool(channel_name, user_id, limit_int)
    
    if not result.get("success"):
        return result.get("message", f"Could not summarize '{channel_name}'")
    
    summary = result.get("summary", "")
    channel = result.get("channel_name", channel_name)
    count = result.get("message_count", 0)
    
    if result.get("needs_llm_summary"):
        return f"**#{channel}** ({count} messages)\n\n{summary}\n\n_Please summarize the above messages._"
    
    return f"**#{channel}** ({count} messages)\n\n{summary}"


def schedule_meeting_func(attendees: str, topic: str = "Quick Sync", duration_minutes: str = "30", when: str = "now", exclude_me: str = "no") -> str:
    """Schedule a meeting - requesting user is host and added by default"""
    duration = _parse_int(duration_minutes, 30)
    start_time = _parse_time(when)
    
    # Get current user (the person requesting the meeting - they are the HOST)
    requesting_user_id = get_current_user()
    include_requester = exclude_me.lower() not in ["yes", "true", "1"]
    
    attendee_list = [a.strip() for a in attendees.split(",") if a.strip()]
    if not attendee_list:
        return "Please provide at least one attendee."
    
    resolved = []
    errors = []
    
    for att in attendee_list:
        r = _resolve_attendee(att)
        if r.get("error"):
            errors.append(r["error"])
        elif not r.get("email"):
            errors.append(f"No email for '{att}'")
        else:
            resolved.append(r)
    
    if not resolved:
        return "Could not resolve any attendees. " + " ".join(errors)
    
    emails = [r["email"] for r in resolved]
    
    # Pass the actual requesting user ID so they become the host
    result = schedule_meeting_tool(
        topic=topic,
        start_time=start_time.isoformat(),
        duration_minutes=duration,
        requesting_user_id=requesting_user_id if include_requester else "",
        participant_emails=emails
    )
    
    if not result.get("success"):
        return result.get("message", "Failed to schedule meeting")
    
    meeting = result.get("meeting", {})
    time_str = start_time.strftime("%A, %B %d at %I:%M %p")
    
    attendee_strs = []
    for r in resolved:
        if r.get("is_external"):
            attendee_strs.append(f"{r['display_name']} ({r['email']}) _(external)_")
        else:
            attendee_strs.append(f"{r['display_name']} ({r['email']})")
    
    # Get host info
    host_email = result.get("host_email", "")
    
    output = f"✅ **Meeting Scheduled!**\n\n"
    output += f"**Topic:** {topic}\n"
    if host_email:
        output += f"**Host:** {host_email}\n"
    output += f"**Attendees:** {', '.join(attendee_strs)}\n"
    output += f"**When:** {time_str}\n"
    output += f"**Duration:** {duration} minutes\n"
    output += f"**Join:** {meeting.get('join_url', 'N/A')}\n"
    
    if errors:
        output += f"\n⚠️ Warnings: {'; '.join(errors)}"
    
    return output


def find_user_func(name: str) -> str:
    """Find user information"""
    result = find_users(name, limit=MAX_USER_RESULTS)
    users = result.get("users", [])
    
    if not users:
        return f"No users found matching '{name}'"
    
    output = f"Found {len(users)} user(s):\n\n"
    for u in users:
        output += f"**{u.get('display_name', 'Unknown')}**\n"
        output += f"  @{u.get('username', 'N/A')} | {u.get('email', 'N/A')}\n\n"
    
    if result.get("has_more"):
        output += "_More results available. Try a more specific search._"
    
    return output


# =============================================================================
# CREATE TOOLS
# =============================================================================

def create_tools() -> List[StructuredTool]:
    """Create all LangChain tools"""
    
    return [
        StructuredTool.from_function(
            func=semantic_search_func,
            name="semantic_search",
            description="Search past Slack messages semantically. Use to find discussions, information, or context about a topic.",
            args_schema=SemanticSearchInput
        ),
        StructuredTool.from_function(
            func=find_experts_func,
            name="find_experts",
            description="Find people who are experts on a topic based on their message history.",
            args_schema=FindExpertsInput
        ),
        StructuredTool.from_function(
            func=explain_jargon_func,
            name="explain_jargon",
            description="Explain company jargon, acronyms, or technical terms.",
            args_schema=ExplainJargonInput
        ),
        StructuredTool.from_function(
            func=summarize_channel_func,
            name="summarize_channel",
            description="Summarize recent conversations in a channel. Use 'all' for all channels.",
            args_schema=SummarizeChannelInput
        ),
        StructuredTool.from_function(
            func=schedule_meeting_func,
            name="schedule_meeting",
            description="Schedule a Zoom meeting. The requesting user is automatically added as host. Provide attendee name(s) or email(s), comma-separated for multiple. Use exclude_me='yes' ONLY if user explicitly says 'don't add me' or 'without me'.",
            args_schema=ScheduleMeetingInput
        ),
        StructuredTool.from_function(
            func=find_user_func,
            name="find_user",
            description="Look up colleague information by name. Returns display name, username, and email.",
            args_schema=FindUserInput
        )
    ]


# Export
ALL_TOOLS = create_tools()
