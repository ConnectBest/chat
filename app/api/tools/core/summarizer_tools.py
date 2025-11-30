from typing import List, Dict, Any, Optional
from .data_tools import fetch_slack_history, get_user_scope, resolve_channel_id
from .db import db_instance

SUMMARY_PROMPT = """
Summarize the following Slack conversation concisely. Focus on:
1. Key decisions made
2. Action items assigned
3. Important announcements
4. Main topics discussed

Format your response with:
- A brief overall summary (2-3 sentences)
- Key Points (bullet points)
- Action Items (if any)

Conversation:
{context}
"""

MULTI_CHANNEL_PROMPT = """
Summarize the following conversations from multiple Slack channels. Focus on:
1. Key decisions made across channels
2. Action items assigned
3. Important announcements
4. Main topics discussed in each channel

Format your response with:
- A brief overall summary (2-3 sentences)
- Per-channel highlights
- Cross-channel themes (if any)
- Action Items (if any)

Conversations:
{context}
"""

def generate_summary_llm(messages: List[dict]) -> dict:
    """Generate summary using LLM."""
    groq_client = db_instance.get_groq_client()
    if not groq_client:
        return {
            "summary": "LLM service not available. Unable to generate summary.",
            "highlights": []
        }
    
    # Format messages for context
    context_lines = []
    for msg in messages:
        user_name = msg.get("user_name", "Unknown")
        text = msg.get("text", "")
        context_lines.append(f"{user_name}: {text}")
    
    context = "\n".join(context_lines)
    
    try:
        completion = groq_client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant that summarizes Slack conversations clearly and concisely."
                },
                {
                    "role": "user",
                    "content": SUMMARY_PROMPT.format(context=context)
                }
            ]
        )
        
        summary = completion.choices[0].message.content
        
        # Extract highlights (action items, decisions)
        highlights = []
        for line in summary.split("\n"):
            if line.strip().startswith("- ") or line.strip().startswith("• "):
                highlights.append(line.strip()[2:])
        
        return {
            "summary": summary,
            "highlights": highlights[:5]  # Top 5 highlights
        }
    
    except Exception as e:
        return {
            "summary": f"Error generating summary: {str(e)}",
            "highlights": []
        }

def summarize_tool(channel_id: str, requesting_user_id: str, limit: int = 50, thread_ts: Optional[str] = None) -> Dict[str, Any]:
    """
    Summarize a channel or thread conversation.
    
    channel_id can be:
    - A channel UUID
    - A channel name (e.g., 'general', 'random')
    - 'all' or 'all_channels' to summarize all accessible channels
    """
    try:
        db = db_instance.get_db()
        scope = get_user_scope(requesting_user_id)
        scope_channels = scope.get("channels", [])
        
        if not scope_channels:
            return {"success": False, "message": "You don't have access to any channels"}
        
        # Handle "all channels" request
        if channel_id and channel_id.lower() in ['all', 'all_channels', 'all channels']:
            return summarize_all_channels(requesting_user_id, scope_channels, limit)
        
        # Resolve channel name to ID if needed
        if db is not None and channel_id:
            resolved_id = resolve_channel_id(channel_id, db)
            if resolved_id:
                channel_id = resolved_id
            else:
                # Try to provide helpful error message
                channel = db.channels.find_one({"name": {"$regex": channel_id, "$options": "i"}})
                if channel:
                    return {
                        "success": False, 
                        "message": f"Channel '{channel_id}' exists but you don't have access to it."
                    }
                return {"success": False, "message": f"Channel '{channel_id}' not found"}
        
        # Check if user has access to this channel
        if channel_id not in scope_channels:
            return {"success": False, "message": "You don't have access to this channel"}

        # Fetch messages
        result = fetch_slack_history(channel_id, limit, thread_ts)
        messages = result.get("messages", [])
        
        if not messages:
            # Get channel name for better UX
            channel_name = channel_id
            if db is not None:
                ch = db.channels.find_one({"id": channel_id})
                if ch:
                    channel_name = ch.get("name", channel_id)
            return {
                "success": True,
                "summary": f"No messages found in #{channel_name} to summarize.",
                "message_count": 0,
                "channel_id": channel_id,
                "channel_name": channel_name
            }
        
        # Generate summary
        summary_result = generate_summary_llm(messages)
        
        # Get channel name
        channel_name = channel_id
        if db is not None:
            ch = db.channels.find_one({"id": channel_id})
            if ch:
                channel_name = ch.get("name", channel_id)
        
        return {
            "success": True,
            "summary": summary_result["summary"],
            "message_count": len(messages),
            "channel_id": channel_id,
            "channel_name": channel_name,
            "highlights": summary_result.get("highlights")
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "message": f"Failed to summarize: {str(e)}"}


def summarize_all_channels(requesting_user_id: str, scope_channels: List[str], limit_per_channel: int = 20) -> Dict[str, Any]:
    """
    Summarize all channels accessible to the user.
    Returns final result. For streaming progress, use summarize_all_channels_stream.
    """
    # Collect all events and return final result
    result = None
    for event in summarize_all_channels_stream(requesting_user_id, scope_channels, limit_per_channel):
        if event.get("type") == "complete":
            result = event.get("data", {})
        elif event.get("type") == "error":
            result = {"success": False, "message": event.get("message", "Unknown error")}
    
    return result or {"success": False, "message": "No result returned"}


def summarize_all_channels_stream(requesting_user_id: str, scope_channels: List[str], limit_per_channel: int = 20):
    """
    Summarize all channels with streaming progress updates.
    Yields events like a waiter informing you of cooking progress.
    
    Event types:
    - status: Progress update message
    - channel_fetched: A channel's messages were fetched
    - generating: About to generate the summary
    - complete: Final result
    - error: An error occurred
    """
    import time
    from concurrent.futures import ThreadPoolExecutor, as_completed
    
    start_time = time.time()
    
    try:
        db = db_instance.get_db()
        groq_client = db_instance.get_groq_client()
        
        if not groq_client:
            yield {"type": "error", "message": "LLM service not available"}
            return
        
        if db is None:
            yield {"type": "error", "message": "Database not available"}
            return
        
        # Step 1: Starting
        yield {
            "type": "status",
            "step": "starting",
            "message": f"🚀 Starting to summarize {len(scope_channels)} channels..."
        }
        
        # Step 2: Loading channel info
        yield {
            "type": "status",
            "step": "loading_channels",
            "message": "📋 Loading channel information..."
        }
        
        channel_names = {}
        for ch_id in scope_channels:
            ch = db.channels.find_one({"id": ch_id})
            channel_names[ch_id] = ch.get("name", ch_id) if ch else ch_id
        
        yield {
            "type": "status",
            "step": "channels_loaded",
            "message": f"✅ Found {len(channel_names)} channels: {', '.join(['#' + n for n in channel_names.values()])}"
        }
        
        # Step 3: Fetch messages from each channel (with per-channel updates)
        yield {
            "type": "status",
            "step": "fetching_messages",
            "message": "📨 Fetching messages from channels..."
        }
        
        def fetch_channel_messages(channel_id):
            result = fetch_slack_history(channel_id, limit_per_channel)
            return channel_id, result.get("messages", [])
        
        all_channel_data = []
        fetched_count = 0
        
        with ThreadPoolExecutor(max_workers=6) as executor:
            futures = {executor.submit(fetch_channel_messages, ch_id): ch_id for ch_id in scope_channels}
            for future in as_completed(futures):
                ch_id, messages = future.result()
                fetched_count += 1
                ch_name = channel_names.get(ch_id, ch_id)
                
                if messages:
                    all_channel_data.append({
                        "channel_id": ch_id,
                        "channel_name": ch_name,
                        "messages": messages,
                        "message_count": len(messages)
                    })
                    yield {
                        "type": "channel_fetched",
                        "step": "channel_done",
                        "channel": ch_name,
                        "message_count": len(messages),
                        "progress": f"{fetched_count}/{len(scope_channels)}",
                        "message": f"📥 #{ch_name}: {len(messages)} messages fetched ({fetched_count}/{len(scope_channels)})"
                    }
                else:
                    yield {
                        "type": "channel_fetched",
                        "step": "channel_empty",
                        "channel": ch_name,
                        "message_count": 0,
                        "progress": f"{fetched_count}/{len(scope_channels)}",
                        "message": f"📭 #{ch_name}: No recent messages ({fetched_count}/{len(scope_channels)})"
                    }
        
        if not all_channel_data:
            yield {
                "type": "complete",
                "data": {
                    "success": True,
                    "summary": "No messages found across your channels.",
                    "channels_summarized": 0,
                    "execution_time": round(time.time() - start_time, 2)
                }
            }
            return
        
        # Step 4: Building context
        yield {
            "type": "status",
            "step": "building_context",
            "message": f"🔨 Building context from {sum(c['message_count'] for c in all_channel_data)} messages..."
        }
        
        all_context = []
        channel_summaries = []
        
        for ch_data in all_channel_data:
            channel_context = f"\n### #{ch_data['channel_name']} ({ch_data['message_count']} messages):\n"
            for msg in ch_data['messages'][-5:]:
                user_name = msg.get("user_name", "Unknown")
                text = msg.get("text", "")[:150]
                channel_context += f"  {user_name}: {text}\n"
            
            all_context.append(channel_context)
            channel_summaries.append({
                "channel_id": ch_data['channel_id'],
                "channel_name": ch_data['channel_name'],
                "message_count": ch_data['message_count']
            })
        
        # Step 5: Generating summary
        yield {
            "type": "status",
            "step": "generating",
            "message": "🧠 AI is analyzing and generating summary..."
        }
        
        context = "\n".join(all_context)
        
        try:
            completion = groq_client.chat.completions.create(
                model="meta-llama/llama-4-scout-17b-16e-instruct",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful assistant. Provide a brief, concise summary."
                    },
                    {
                        "role": "user",
                        "content": f"Briefly summarize these channel conversations in 3-4 sentences total:\n{context}"
                    }
                ],
                max_tokens=500
            )
            
            summary = completion.choices[0].message.content
            
            # Step 6: Complete!
            yield {
                "type": "status",
                "step": "done",
                "message": "✨ Summary ready!"
            }
            
            yield {
                "type": "complete",
                "data": {
                    "success": True,
                    "summary": summary,
                    "channels_summarized": len(channel_summaries),
                    "channel_details": channel_summaries,
                    "total_messages": sum(c["message_count"] for c in channel_summaries),
                    "execution_time": round(time.time() - start_time, 2)
                }
            }
        
        except Exception as e:
            yield {"type": "error", "message": f"Error generating summary: {str(e)}"}
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        yield {"type": "error", "message": f"Failed to summarize all channels: {str(e)}"}
