"""
LangGraph Agent with MongoDB Memory

Clean implementation with:
- ReAct agent pattern
- MongoDB session memory (24h TTL)
- LangSmith observability
"""

import os
import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

from pymongo import MongoClient, DESCENDING
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_groq import ChatGroq
from langchain.agents import create_agent

from .config import (
    MONGO_URI, MONGO_DATABASE, GROQ_API_KEY, GROQ_MODEL,
    LANGSMITH_API_KEY, LANGSMITH_PROJECT,
    SESSION_TTL_HOURS, AGENT_MEMORY_COLLECTION
)
from .tools import ALL_TOOLS, set_current_user


# Enable LangSmith if configured
if LANGSMITH_API_KEY:
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGCHAIN_API_KEY"] = LANGSMITH_API_KEY
    os.environ["LANGCHAIN_PROJECT"] = LANGSMITH_PROJECT
    print(f"✅ LangSmith enabled: {LANGSMITH_PROJECT}")


SYSTEM_PROMPT = """You are ConnectBest AI, a helpful Slack assistant.

**Available Tools:**
1. semantic_search(query, channel_name?, limit?) - Search Slack messages
2. find_experts(topic, limit?) - Find people who know about topics  
3. explain_jargon(term) - Explain terms/acronyms
4. summarize_channel(channel_name, message_limit?) - Summarize channel conversations
5. schedule_meeting(attendees, topic?, duration_minutes?, when?, exclude_me?) - Schedule Zoom meetings
6. find_user(name) - Look up colleague info by name

**CRITICAL RULES:**
1. ALWAYS call the appropriate tool - NEVER generate fake tool outputs or pretend you called a tool.
2. Each request to schedule a meeting MUST call schedule_meeting tool - even if similar request was made before.
3. Each search, lookup, or action MUST actually invoke the tool.
4. Do NOT use conversation history to skip tool calls - always call the tool fresh.
5. For find_experts: Return the EXACT tool output as-is. Do NOT summarize, reformat, or omit any part of it (including example quotes).

**Tool Parameter Rules:**
- All parameters must be plain strings
- schedule_meeting: set exclude_me="yes" ONLY if user explicitly says "don't add me" or "without me"

**Guidelines:**
- User ID: {user_id}
- Be concise and helpful
- Use markdown formatting"""


class MemoryManager:
    """MongoDB-based conversation memory"""
    
    def __init__(self, mongo_uri: str, database: str):
        self.client = MongoClient(mongo_uri)
        self.db = self.client[database]
        self.collection = self.db[AGENT_MEMORY_COLLECTION]
        self._ensure_indexes()
    
    def _ensure_indexes(self):
        try:
            self.collection.create_index("created_at", expireAfterSeconds=SESSION_TTL_HOURS * 3600)
            self.collection.create_index("user_id")
            self.collection.create_index("session_id")
        except Exception as e:
            print(f"Index warning: {e}")
    
    def get_or_create_session(self, user_id: str) -> str:
        cutoff = datetime.now() - timedelta(hours=SESSION_TTL_HOURS)
        
        existing = self.collection.find_one(
            {"user_id": user_id, "created_at": {"$gte": cutoff}},
            sort=[("created_at", DESCENDING)]
        )
        
        if existing:
            return existing["session_id"]
        
        session_id = str(uuid.uuid4())
        self.collection.insert_one({
            "user_id": user_id,
            "session_id": session_id,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "messages": []
        })
        return session_id
    
    def load_messages(self, session_id: str, limit: int = 10) -> List:
        session = self.collection.find_one({"session_id": session_id})
        if not session:
            return []
        
        raw = session.get("messages", [])[-limit:]
        messages = []
        for msg in raw:
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                messages.append(AIMessage(content=msg["content"]))
        return messages
    
    def save_message(self, session_id: str, role: str, content: str):
        self.collection.update_one(
            {"session_id": session_id},
            {
                "$push": {"messages": {"role": role, "content": content, "timestamp": datetime.now()}},
                "$set": {"updated_at": datetime.now()}
            }
        )
    
    def get_session_info(self, session_id: str) -> Optional[Dict]:
        session = self.collection.find_one({"session_id": session_id})
        if session:
            return {"message_count": len(session.get("messages", []))}
        return None
    
    def get_user_sessions(self, user_id: str) -> List[Dict]:
        sessions = list(self.collection.find(
            {"user_id": user_id},
            {"session_id": 1, "created_at": 1, "updated_at": 1, "messages": 1}
        ).sort("created_at", DESCENDING))
        
        for s in sessions:
            s["message_count"] = len(s.get("messages", []))
            del s["messages"]
        return sessions
    
    def clear_session(self, session_id: str) -> bool:
        result = self.collection.delete_one({"session_id": session_id})
        return result.deleted_count > 0
    
    def clear_user_sessions(self, user_id: str) -> int:
        result = self.collection.delete_many({"user_id": user_id})
        return result.deleted_count


class ConnectBestAgent:
    """LangGraph agent with memory"""
    
    def __init__(self):
        if not MONGO_URI:
            raise RuntimeError("MONGO_URI not set")
        if not GROQ_API_KEY:
            raise RuntimeError("GROQ_API_KEY not set")
        
        self.memory = MemoryManager(MONGO_URI, MONGO_DATABASE)
        # Bind tools explicitly with strict=False for more lenient parsing
        base_llm = ChatGroq(api_key=GROQ_API_KEY, model_name=GROQ_MODEL, temperature=0.1)
        self.llm = base_llm.bind_tools(ALL_TOOLS)
        self.tools = ALL_TOOLS
        self.agent = create_agent(base_llm, self.tools, system_prompt=SYSTEM_PROMPT)
        print(f"✅ Agent ready with {len(self.tools)} tools")
    
    async def chat(self, message: str, user_id: str, include_history: bool = True) -> Dict[str, Any]:
        session_id = self.memory.get_or_create_session(user_id)
        set_current_user(user_id)
        
        messages = [SystemMessage(content=SYSTEM_PROMPT.replace("{user_id}", user_id))]
        
        if include_history:
            messages.extend(self.memory.load_messages(session_id))
        
        messages.append(HumanMessage(content=message))
        
        config = {"configurable": {"thread_id": session_id}}
        if LANGSMITH_API_KEY:
            config["metadata"] = {"user_id": user_id, "session_id": session_id}
        
        result = await self.agent.ainvoke({"messages": messages}, config=config)
        
        response = result["messages"][-1].content
        
        self.memory.save_message(session_id, "user", message)
        self.memory.save_message(session_id, "assistant", response)
        
        info = self.memory.get_session_info(session_id)
        
        return {
            "response": response,
            "session_id": session_id,
            "user_id": user_id,
            "message_count": info.get("message_count", 0) if info else 0
        }
    
    def get_session_history(self, session_id: str) -> List[Dict]:
        session = self.memory.collection.find_one({"session_id": session_id})
        if not session:
            return []
        return [{"role": m["role"], "content": m["content"], "timestamp": m.get("timestamp")} 
                for m in session.get("messages", [])]
    
    def clear_session(self, session_id: str) -> bool:
        return self.memory.clear_session(session_id)
    
    def clear_user_history(self, user_id: str) -> int:
        return self.memory.clear_user_sessions(user_id)


# Singleton
_agent: Optional[ConnectBestAgent] = None


def get_agent() -> ConnectBestAgent:
    global _agent
    if _agent is None:
        _agent = ConnectBestAgent()
    return _agent


def init_agent() -> ConnectBestAgent:
    return get_agent()
