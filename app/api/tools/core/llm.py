"""
Core LLM Module

Provides a unified interface for LLM interactions across all agents.
Supports Groq provider.
"""

from typing import Optional, List, Dict, Any
from groq import Groq
import json
import os
from dotenv import load_dotenv

load_dotenv()


class LLMProvider:
    """Unified LLM provider interface."""
    
    def __init__(
        self,
        provider: str = "groq",
        api_key: Optional[str] = None,
        model: Optional[str] = None
    ):
        """
        Initialize LLM provider.
        
        Args:
            provider: "groq"
            api_key: API key (or uses env var)
            model: Model name (or uses default)
        """
        self.provider = provider
        self.client = None
        
        if provider == "groq":
            key = api_key or os.getenv("GROQ_API_KEY")
            if key:
                self.client = Groq(api_key=key)
                self.model = model or os.getenv("GROQ_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")
            else:
                raise ValueError("GROQ_API_KEY not set")
        
        else:
            raise ValueError(f"Unsupported provider: {provider}. Only 'groq' is supported.")
    
    def chat(
        self,
        messages: List[Dict[str, str]],
        json_response: bool = False,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None
    ) -> str:
        """
        Send chat completion request.
        
        Args:
            messages: List of message dicts with "role" and "content"
            json_response: Whether to request JSON output
            temperature: Sampling temperature
            max_tokens: Maximum tokens in response
        
        Returns:
            Response text
        """
        kwargs = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
        }
        
        if json_response:
            kwargs["response_format"] = {"type": "json_object"}
        
        if max_tokens:
            kwargs["max_tokens"] = max_tokens
        
        completion = self.client.chat.completions.create(**kwargs)
        return completion.choices[0].message.content
    
    def chat_json(
        self,
        system_prompt: str,
        user_message: str,
        temperature: float = 0.7
    ) -> Dict[str, Any]:
        """
        Chat with JSON response parsing.
        
        Args:
            system_prompt: System message
            user_message: User message
            temperature: Sampling temperature
        
        Returns:
            Parsed JSON response
        """
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ]
        
        response = self.chat(messages, json_response=True, temperature=temperature)
        return json.loads(response)
    
    def simple_chat(
        self,
        prompt: str,
        system: str = "You are a helpful assistant.",
        temperature: float = 0.7
    ) -> str:
        """
        Simple single-turn chat.
        
        Args:
            prompt: User prompt
            system: System message
            temperature: Sampling temperature
        
        Returns:
            Response text
        """
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt}
        ]
        
        return self.chat(messages, temperature=temperature)


def get_llm(provider: str = "groq") -> LLMProvider:
    """
    Factory function to get LLM provider.
    
    Args:
        provider: "groq"
    
    Returns:
        LLMProvider instance
    """
    return LLMProvider(provider=provider)


# Default Groq client for convenience
def get_default_llm() -> Optional[LLMProvider]:
    """Get default LLM provider (Groq), or None if not configured."""
    try:
        return get_llm("groq")
    except ValueError:
        return None


# =============================================================================
# COMMON PROMPTS
# =============================================================================

INTENT_CLASSIFICATION_PROMPT = """
You are an intent classifier for a Slack AI assistant. Classify the user's intent.

Available intents:
- schedule_meeting: Schedule a meeting or call
- expert_finder: Find experts on a topic  
- summarize: Summarize a channel or thread
- jargon_buster: Explain a term or acronym
- semantic_search: Search for messages
- data_query: Query about users, channels, etc.
- chat: General conversation

Output JSON:
{
    "intent": "intent_name",
    "parameters": {...},
    "confidence": 0.0-1.0
}
"""


CHAT_SYSTEM_PROMPT = """
You are a friendly Slack AI assistant for ConnectBest.
You help users with:
- Scheduling meetings
- Finding experts on topics
- Summarizing channels and threads
- Explaining jargon and acronyms
- Searching past messages

Be concise, helpful, and professional.
"""
