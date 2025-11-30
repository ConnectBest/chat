"""
Core Configuration Module

Centralized configuration for all agents in the multi-agent system.
Uses environment variables with sensible defaults.
"""

import os
from typing import Optional
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Central configuration class."""
    
    # ==========================================================================
    # DATABASE
    # ==========================================================================
    MONGO_URI: str = os.getenv("MONGO_URI", "")
    MONGO_DATABASE: str = os.getenv("MONGO_DATABASE", "connectbest_chat")
    
    # MongoDB Atlas Vector Search
    VECTOR_INDEX_NAME: str = os.getenv("VECTOR_INDEX_NAME", "vector_index")
    VECTOR_FIELD_NAME: str = os.getenv("VECTOR_FIELD_NAME", "embedding")
    
    
    # ==========================================================================
    # LLM PROVIDERS
    # ==========================================================================
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")
    
    # ==========================================================================
    # EMBEDDING MODEL
    # ==========================================================================
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
    
    # ==========================================================================
    # EXTERNAL APIS
    # ==========================================================================
    
    # Gmail OAuth
    GMAIL_CLIENT_ID: str = os.getenv("GMAIL_CLIENT_ID", "")
    GMAIL_CLIENT_SECRET: str = os.getenv("GMAIL_CLIENT_SECRET", "")
    GMAIL_REFRESH_TOKEN: str = os.getenv("GMAIL_REFRESH_TOKEN", "")
    SENDER_EMAIL: str = os.getenv("SENDER_EMAIL", "")
    
    # Zoom OAuth
    ZOOM_CLIENT_ID: str = os.getenv("ZOOM_CLIENT_ID", "")
    ZOOM_CLIENT_SECRET: str = os.getenv("ZOOM_CLIENT_SECRET", "")
    ZOOM_ACCOUNT_ID: str = os.getenv("ZOOM_ACCOUNT_ID", "")
    ZOOM_USER_ID: str = os.getenv("ZOOM_USER_ID", "me")
    
    # ==========================================================================
    # SLACK
    # ==========================================================================
    SLACK_BOT_TOKEN: str = os.getenv("SLACK_BOT_TOKEN", "")
    SLACK_SIGNING_SECRET: str = os.getenv("SLACK_SIGNING_SECRET", "")
    SLACK_APP_TOKEN: str = os.getenv("SLACK_APP_TOKEN", "")
    SLACK_MODE: str = os.getenv("SLACK_MODE", "socket")  # socket or http
    
    # ==========================================================================
    # AGENT URLS (Hub and Spoke Architecture)
    # ==========================================================================
    ORCHESTRATOR_URL: str = os.getenv("ORCHESTRATOR_URL", "http://localhost:8006")
    DATABASE_AGENT_URL: str = os.getenv("DATABASE_AGENT_URL", "http://localhost:8007")
    MEETING_SCHEDULER_URL: str = os.getenv("MEETING_SCHEDULER_URL", "http://localhost:8000")
    SEMANTIC_SEARCH_URL: str = os.getenv("SEMANTIC_SEARCH_URL", "http://localhost:8001")
    USER_LOOKUP_URL: str = os.getenv("USER_LOOKUP_URL", "http://localhost:8002")
    EXPERT_FINDER_URL: str = os.getenv("EXPERT_FINDER_URL", "http://localhost:8003")
    JARGON_BUSTER_URL: str = os.getenv("JARGON_BUSTER_URL", "http://localhost:8004")
    SUMMARIZER_URL: str = os.getenv("SUMMARIZER_URL", "http://localhost:8005")
    
    # ==========================================================================
    # AGENT PORTS
    # ==========================================================================
    AGENT_PORTS = {
        "meeting_scheduler": 8000,
        "semantic_search": 8001,
        "user_lookup": 8002,
        "expert_finder": 8003,
        "jargon_buster": 8004,
        "summarizer": 8005,
        "orchestrator": 8006,
        "database": 8007,
    }
    
    # ==========================================================================
    # TIMEOUTS AND LIMITS
    # ==========================================================================
    HTTP_TIMEOUT: float = float(os.getenv("HTTP_TIMEOUT", "30.0"))
    DEFAULT_TOP_K: int = int(os.getenv("DEFAULT_TOP_K", "5"))
    MAX_MESSAGE_LIMIT: int = int(os.getenv("MAX_MESSAGE_LIMIT", "100"))
    
    # ==========================================================================
    # VALIDATION
    # ==========================================================================
    @classmethod
    def validate_database(cls) -> bool:
        """Check if database configuration is valid."""
        return bool(cls.MONGO_URI)
    
    @classmethod
    def validate_llm(cls) -> bool:
        """Check if LLM configuration is valid."""
        return bool(cls.GROQ_API_KEY)
    
    @classmethod
    def validate_slack(cls) -> bool:
        """Check if Slack configuration is valid."""
        return bool(cls.SLACK_BOT_TOKEN and cls.SLACK_SIGNING_SECRET)
    
    @classmethod
    def validate_zoom(cls) -> bool:
        """Check if Zoom configuration is valid."""
        return bool(cls.ZOOM_CLIENT_ID and cls.ZOOM_CLIENT_SECRET and cls.ZOOM_ACCOUNT_ID)
    
    @classmethod
    def validate_gmail(cls) -> bool:
        """Check if Gmail configuration is valid."""
        return bool(cls.GMAIL_CLIENT_ID and cls.GMAIL_CLIENT_SECRET and cls.GMAIL_REFRESH_TOKEN)
    
    @classmethod
    def get_status(cls) -> dict:
        """Get configuration status summary."""
        return {
            "database": cls.validate_database(),
            "llm": cls.validate_llm(),
            "slack": cls.validate_slack(),
            "zoom": cls.validate_zoom(),
            "gmail": cls.validate_gmail(),
        }


# Singleton instance
config = Config()
