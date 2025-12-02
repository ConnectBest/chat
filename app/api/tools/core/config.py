"""
Core Configuration - Minimal config for ConnectBest AI Agent
"""

import os
from dotenv import load_dotenv

load_dotenv()

# Database
MONGO_URI = os.getenv("MONGO_URI", "")
MONGO_DATABASE = os.getenv("MONGO_DATABASE", "connectbest_chat")

# LLM - Using meta-llama/llama-4-scout-17b-16e-instruct
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")

# Embedding
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

# Vector Search
VECTOR_INDEX_NAME = os.getenv("VECTOR_INDEX_NAME", "vector_index")
VECTOR_FIELD_NAME = os.getenv("VECTOR_FIELD_NAME", "embedding")
EMBEDDINGS_COLLECTION = "message_embeddings"

# LangSmith
LANGSMITH_API_KEY = os.getenv("LANGSMITH_API_KEY")
LANGSMITH_PROJECT = os.getenv("LANGSMITH_PROJECT", "connectbest-agent")

# Memory
SESSION_TTL_HOURS = 24
AGENT_MEMORY_COLLECTION = "agent_conversations"

# Limits
CACHE_TTL_SECONDS = 300  # 5 minutes
DEFAULT_TOP_K = 10
MAX_MESSAGE_LIMIT = 100
MAX_USER_RESULTS = 5
