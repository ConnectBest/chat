"""
Core Module for Multi-Agent Slack Application

This package provides shared utilities for all agents:
- config: Centralized configuration
- llm: Unified LLM interface
"""

from .config import Config, config
from .llm import LLMProvider, get_llm, get_default_llm

__all__ = [
    "Config",
    "config", 
    "LLMProvider",
    "get_llm",
    "get_default_llm",
]
