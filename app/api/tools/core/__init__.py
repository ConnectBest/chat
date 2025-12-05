"""
ConnectBest AI Agent Core

Clean modular structure:
- config.py: Configuration constants
- db.py: Database singleton
- data_tools.py: Database operations
- tools.py: LangChain tool definitions
- agent.py: LangGraph agent
- jargon_tools.py: Jargon lookup
- summarizer_tools.py: Channel summarization
- meeting_tools.py: Zoom/Gmail integration
"""

from .agent import ConnectBestAgent, get_agent, init_agent
from .tools import ALL_TOOLS, create_tools, set_current_user, get_current_user

__all__ = [
    "ConnectBestAgent",
    "get_agent", 
    "init_agent",
    "ALL_TOOLS",
    "create_tools",
    "set_current_user",
    "get_current_user",
]
