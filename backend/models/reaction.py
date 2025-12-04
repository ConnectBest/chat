"""
Reaction Model

Stores message reactions as a separate collection for better scalability.
Supports emoji reactions with aggregation capabilities.
"""

from datetime import datetime
from bson.objectid import ObjectId
from typing import Optional, Dict, Any, List


class Reaction:
    """
    Reaction Model for message reactions.
    
    Collection: 'reactions'
    
    Fields:
        - message_id: Reference to message
        - user_id: User who reacted
        - emoji: Emoji character
        - created_at: When reaction was added
    """
    
    COLLECTION = 'reactions'
    
    def __init__(self, db):
        """Initialize Reaction model with database connection."""
        self.collection = db[self.COLLECTION]
        self._create_indexes()
    
    def _create_indexes(self):
        """Create indexes for efficient queries."""
        # Compound unique index: one emoji per user per message
        self.collection.create_index(
            [('message_id', 1), ('user_id', 1)],
            unique=True
        )
        # Index for finding all reactions on a message
        self.collection.create_index([('message_id', 1)])
        # Index for finding user's reactions
        self.collection.create_index([('user_id', 1)])
        # Compound index for emoji filtering
        self.collection.create_index([('message_id', 1), ('emoji', 1)])
    
    def add_reaction(self, message_id: str, user_id: str, emoji: str) -> Dict[str, Any]:
        """
        Add a reaction to a message.
        
        Note: User can only have one reaction per message.
        If they already reacted, this will update the emoji.
        
        Args:
            message_id: Message ID
            user_id: User ID
            emoji: Emoji character
        
        Returns:
            dict: Created/updated reaction document
        """
        try:
            doc = {
                'message_id': ObjectId(message_id),
                'user_id': ObjectId(user_id),
                'emoji': emoji,
                'created_at': datetime.utcnow()
            }
            
            # Upsert: update if exists, insert if not
            result = self.collection.update_one(
                {
                    'message_id': ObjectId(message_id),
                    'user_id': ObjectId(user_id)
                },
                {'$set': doc},
                upsert=True
            )
            
            return {
                'message_id': message_id,
                'user_id': user_id,
                'emoji': emoji,
                'created_at': doc['created_at'].isoformat()
            }
        except Exception as e:
            raise e
    
    def remove_reaction(self, message_id: str, user_id: str) -> bool:
        """
        Remove a user's reaction from a message.
        
        Args:
            message_id: Message ID
            user_id: User ID
        
        Returns:
            bool: True if successful
        """
        try:
            result = self.collection.delete_one({
                'message_id': ObjectId(message_id),
                'user_id': ObjectId(user_id)
            })
            return result.deleted_count > 0
        except Exception:
            return False
    
    def get_message_reactions(self, message_id: str) -> List[Dict[str, Any]]:
        """
        Get all reactions for a message, grouped by emoji.
        
        Args:
            message_id: Message ID
        
        Returns:
            list: List of reactions with counts
            Example: [{'emoji': '👍', 'count': 5, 'users': ['user1', 'user2', ...]}, ...]
        """
        try:
            pipeline = [
                {
                    '$match': {'message_id': ObjectId(message_id)}
                },
                {
                    '$group': {
                        '_id': '$emoji',
                        'count': {'$sum': 1},
                        'users': {'$push': '$user_id'}
                    }
                },
                {
                    '$sort': {'count': -1}
                }
            ]
            
            reactions = list(self.collection.aggregate(pipeline))
            
            return [
                {
                    'emoji': r['_id'],
                    'count': r['count'],
                    'users': [str(uid) for uid in r['users']]
                }
                for r in reactions
            ]
        except Exception:
            return []
    
    def get_user_reaction(self, message_id: str, user_id: str) -> Optional[str]:
        """
        Get a user's reaction on a message.
        
        Args:
            message_id: Message ID
            user_id: User ID
        
        Returns:
            str: Emoji or None if user hasn't reacted
        """
        try:
            doc = self.collection.find_one({
                'message_id': ObjectId(message_id),
                'user_id': ObjectId(user_id)
            })
            return doc['emoji'] if doc else None
        except Exception:
            return None
    
    def count_reactions(self, message_id: str) -> int:
        """
        Count total reactions on a message.
        
        Args:
            message_id: Message ID
        
        Returns:
            int: Total reaction count
        """
        try:
            return self.collection.count_documents({'message_id': ObjectId(message_id)})
        except Exception:
            return 0
    
    def delete_message_reactions(self, message_id: str) -> int:
        """
        Delete all reactions for a message.
        
        Args:
            message_id: Message ID
        
        Returns:
            int: Number of reactions deleted
        """
        try:
            result = self.collection.delete_many({'message_id': ObjectId(message_id)})
            return result.deleted_count
        except Exception:
            return 0
    
    def get_top_reactions(self, message_ids: List[str], limit: int = 5) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get top reactions for multiple messages.
        
        Args:
            message_ids: List of message IDs
            limit: Max reactions per message
        
        Returns:
            dict: Map of message_id -> reactions
        """
        try:
            pipeline = [
                {
                    '$match': {
                        'message_id': {'$in': [ObjectId(mid) for mid in message_ids]}
                    }
                },
                {
                    '$group': {
                        '_id': {
                            'message_id': '$message_id',
                            'emoji': '$emoji'
                        },
                        'count': {'$sum': 1},
                        'users': {'$push': '$user_id'}
                    }
                },
                {
                    '$sort': {'count': -1}
                },
                {
                    '$group': {
                        '_id': '$_id.message_id',
                        'reactions': {
                            '$push': {
                                'emoji': '$_id.emoji',
                                'count': '$count',
                                'users': '$users'
                            }
                        }
                    }
                }
            ]
            
            results = list(self.collection.aggregate(pipeline))
            
            # Format results
            reaction_map = {}
            for result in results:
                message_id = str(result['_id'])
                reactions = [
                    {
                        'emoji': r['emoji'],
                        'count': r['count'],
                        'users': [str(uid) for uid in r['users']]
                    }
                    for r in result['reactions'][:limit]
                ]
                reaction_map[message_id] = reactions
            
            return reaction_map
        except Exception:
            return {}
    
    def get_popular_emojis(self, channel_id: str, messages_collection, 
                          limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get most popular emojis in a channel.
        
        Args:
            channel_id: Channel ID
            messages_collection: MongoDB messages collection
            limit: Max emojis to return
        
        Returns:
            list: Popular emojis with counts
        """
        try:
            # First get message IDs in channel
            messages = messages_collection.find(
                {'channel_id': ObjectId(channel_id)},
                {'_id': 1}
            )
            message_ids = [msg['_id'] for msg in messages]
            
            if not message_ids:
                return []
            
            # Aggregate reactions
            pipeline = [
                {
                    '$match': {'message_id': {'$in': message_ids}}
                },
                {
                    '$group': {
                        '_id': '$emoji',
                        'count': {'$sum': 1}
                    }
                },
                {
                    '$sort': {'count': -1}
                },
                {
                    '$limit': limit
                }
            ]
            
            results = list(self.collection.aggregate(pipeline))
            
            return [
                {'emoji': r['_id'], 'count': r['count']}
                for r in results
            ]
        except Exception:
            return []
