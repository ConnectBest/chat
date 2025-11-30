from typing import List, Dict, Any
from .data_tools import find_experts_in_db, get_user_scope

def find_experts_tool(topic: str, requesting_user_id: str, top_k: int = 3) -> Dict[str, Any]:
    """
    Find experts on a given topic.
    """
    try:
        # Get user scope
        scope = get_user_scope(requesting_user_id)
        scope_channels = scope.get("channels", [])
        
        # Find experts using database aggregation
        result = find_experts_in_db(topic, scope_channels, top_k)
        experts = result.get("experts", [])
        
        return {
            "success": True,
            "experts": experts,
            "count": len(experts),
            "message": f"Found {len(experts)} expert(s) on '{topic}'"
        }
    except Exception as e:
        return {"success": False, "message": f"Failed to find experts: {str(e)}"}
