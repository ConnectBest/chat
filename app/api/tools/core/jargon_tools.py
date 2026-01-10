"""
Jargon Tools - Explain company terms and acronyms

Simplified: Just return glossary data, let the agent's LLM explain if needed.
This avoids a redundant LLM call inside the tool.
"""

from typing import Dict, Any, Optional
from .data_tools import search_glossary


def jargon_buster_tool(term: str, context: str = "", requesting_user_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Look up a jargon term in the glossary.
    Returns definition data for the agent to format/explain.
    """
    try:
        result = search_glossary(term)
        definitions = result.get("definitions", [])
        
        if definitions:
            # Found in glossary
            best_match = definitions[0]
            return {
                "success": True,
                "term": term,
                "explanation": best_match.get("definition", ""),
                "source": best_match.get("source", "Internal Glossary"),
                "found_in_glossary": True
            }
        else:
            # Not in glossary - agent will use its own knowledge
            return {
                "success": True,
                "term": term,
                "explanation": f"No internal definition found for '{term}'. Use general knowledge to explain.",
                "source": "Not in glossary",
                "found_in_glossary": False
            }
    
    except Exception as e:
        return {"success": False, "message": f"Failed to look up term: {str(e)}"}
