"""
Summarizer Tools - Channel summarization

Simplified: Returns formatted messages for the agent's LLM to summarize.
This avoids a redundant LLM call inside the tool.
Optimized with message truncation for token efficiency.
"""

from typing import List, Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

from .data_tools import fetch_slack_history, get_user_scope, resolve_channel_id
from .db import db_instance


# Message truncation settings
MAX_MSG_CHARS = 100  # Truncate long messages
MAX_MSGS_PER_CHANNEL = 20  # Limit messages per channel


def _truncate(text: str, max_len: int = MAX_MSG_CHARS) -> str:
    """Truncate text with ellipsis"""
    if len(text) <= max_len:
        return text
    return text[:max_len-3] + "..."


def _format_messages(messages: List[dict], max_msgs: int = MAX_MSGS_PER_CHANNEL) -> str:
    """Format messages into a compact string for LLM context"""
    lines = []
    for msg in messages[-max_msgs:]:  # Take most recent
        user = msg.get("user_name", "Unknown")
        text = _truncate(msg.get("text", ""))
        lines.append(f"- {user}: {text}")
    return "\n".join(lines)


def summarize_tool(
    channel_id: str, 
    requesting_user_id: str, 
    limit: int = 50, 
    thread_ts: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get messages from a channel for summarization.
    Returns formatted messages for the agent to summarize.
    
    channel_id can be:
    - A channel UUID
    - A channel name (e.g., 'general')
    - 'all' to get messages from all accessible channels
    """
    try:
        db = db_instance.get_db()
        scope = get_user_scope(requesting_user_id)
        scope_channels = scope.get("channels", [])
        
        if not scope_channels:
            return {"success": False, "message": "You don't have access to any channels"}
        
        # Handle "all channels" request
        if channel_id and channel_id.lower() in ['all', 'all_channels', 'all channels']:
            return _summarize_all_channels(scope_channels, limit)
        
        # Resolve channel name to ID
        if db is not None and channel_id:
            resolved_id = resolve_channel_id(channel_id, db)
            if resolved_id:
                channel_id = resolved_id
            else:
                return {"success": False, "message": f"Channel '{channel_id}' not found"}
        
        # Check access
        if channel_id not in scope_channels:
            return {"success": False, "message": "You don't have access to this channel"}

        # Fetch messages
        result = fetch_slack_history(channel_id, limit, thread_ts)
        messages = result.get("messages", [])
        
        # Get channel name
        channel_name = channel_id
        if db is not None:
            ch = db.channels.find_one({"id": channel_id})
            if ch:
                channel_name = ch.get("name", channel_id)
        
        if not messages:
            return {
                "success": True,
                "summary": f"No messages found in #{channel_name}.",
                "message_count": 0,
                "channel_name": channel_name
            }
        
        # Format messages for agent to summarize
        formatted = _format_messages(messages)
        
        return {
            "success": True,
            "summary": f"Recent messages from #{channel_name}:\n{formatted}",
            "message_count": len(messages),
            "channel_name": channel_name,
            "needs_llm_summary": True  # Signal that agent should summarize this
        }
    
    except Exception as e:
        return {"success": False, "message": f"Failed to get messages: {str(e)}"}


def _summarize_all_channels(scope_channels: List[str], limit_per_channel: int = 20) -> Dict[str, Any]:
    """Get messages from all channels for summarization"""
    db = db_instance.get_db()
    if db is None:
        return {"success": False, "message": "Database not available"}
    
    # Get channel names
    channel_names = {}
    for ch_id in scope_channels:
        ch = db.channels.find_one({"id": ch_id})
        channel_names[ch_id] = ch.get("name", ch_id) if ch else ch_id
    
    # Fetch messages in parallel
    def fetch_channel(channel_id):
        result = fetch_slack_history(channel_id, limit_per_channel)
        return channel_id, result.get("messages", [])
    
    all_data = []
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(fetch_channel, ch_id): ch_id for ch_id in scope_channels}
        for future in as_completed(futures):
            ch_id, messages = future.result()
            if messages:
                all_data.append({
                    "channel_id": ch_id,
                    "channel_name": channel_names.get(ch_id, ch_id),
                    "messages": messages,
                    "count": len(messages)
                })
    
    if not all_data:
        return {
            "success": True,
            "summary": "No messages found in any channel.",
            "channels_summarized": 0
        }
    
    # Format all channels
    output_lines = []
    total_msgs = 0
    
    for ch_data in all_data:
        ch_name = ch_data["channel_name"]
        msgs = ch_data["messages"]
        total_msgs += len(msgs)
        
        output_lines.append(f"\n### #{ch_name} ({len(msgs)} messages):")
        formatted = _format_messages(msgs, max_msgs=5)  # Limit per channel
        output_lines.append(formatted)
    
    return {
        "success": True,
        "summary": "\n".join(output_lines),
        "channels_summarized": len(all_data),
        "total_messages": total_msgs,
        "channel_details": [{"name": c["channel_name"], "count": c["count"]} for c in all_data],
        "needs_llm_summary": True
    }
