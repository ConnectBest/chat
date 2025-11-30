from typing import Dict, Any, Optional
from .data_tools import search_glossary
from .db import db_instance

EXPLANATION_PROMPT = """
You are an expert at explaining enterprise jargon to new employees.

Term: {term}
Context: {context}
Internal Definition: {definition}

Please explain this term simply and clearly. 
- If an internal definition exists, prioritize and expand on it.
- If not, provide a general explanation but note it might not be company-specific.
- Include examples if helpful.
- Keep it concise (2-3 paragraphs max).
"""

def generate_explanation_llm(term: str, context: str, definition: str) -> str:
    """Generate explanation using LLM."""
    groq_client = db_instance.get_groq_client()
    if not groq_client:
        if definition:
            return definition
        return f"Unable to explain '{term}' - LLM service unavailable."
    
    try:
        completion = groq_client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[
                {"role": "system", "content": "Explain terms clearly and concisely."},
                {"role": "user", "content": EXPLANATION_PROMPT.format(
                    term=term,
                    context=context or "No specific context provided",
                    definition=definition or "No internal definition found"
                )}
            ]
        )
        
        return completion.choices[0].message.content
    
    except Exception as e:
        return f"Error generating explanation: {str(e)}"

def jargon_buster_tool(term: str, context: str = "", requesting_user_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Explain a jargon term or acronym.
    """
    try:
        # 1. Search for existing definition in glossary
        glossary_result = search_glossary(term)
        definitions = glossary_result.get("definitions", [])
        
        found = False
        definition = "No internal definition found."
        source = "General Knowledge (LLM)"
        
        if definitions:
            found = True
            definition = definitions[0].get("definition", "")
            source = definitions[0].get("source", "Internal Glossary")
        
        # 2. Generate explanation
        explanation = generate_explanation_llm(
            term,
            context,
            definition if found else ""
        )
        
        return {
            "success": True,
            "term": term,
            "definition": definition,
            "explanation": explanation,
            "source": source
        }
    except Exception as e:
        return {"success": False, "message": f"Failed to explain jargon: {str(e)}"}
