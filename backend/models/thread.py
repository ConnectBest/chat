"""
Thread Model

Tracks thread relationships between parent messages and replies.
Improves query performance for thread-based features.
"""

from datetime import datetime
from bson.objectid import ObjectId
from typing import Optional, Dict, Any, List


class Thread:
    """
    Thread Model for tracking message threads.
    
    Collection: 'threads'
    
    Fields:
        - parent_id: Parent message ID
        - reply_id: Reply message ID
        - created_at: When reply was added
    """
    
    COLLECTION = 'threads'
    
    def __init__(self, db):
        """Initialize Thread model with database connection."""
        self.collection = db[self.COLLECTION]
        self._create_indexes()
    
    def _create_indexes(self):
        """Create indexes for efficient queries."""
        # Compound unique index
        self.collection.create_index(
            [('parent_id', 1), ('reply_id', 1)],
            unique=True
        )
        # Index for finding all replies to a parent
        self.collection.create_index([('parent_id', 1), ('created_at', 1)])
        # Index for finding parent of a reply
        self.collection.create_index([('reply_id', 1)])
    
    def add_reply(self, parent_id: str, reply_id: str) -> Dict[str, Any]:
        """
        Add a reply to a thread.
        
        Args:
            parent_id: Parent message ID
            reply_id: Reply message ID
        
        Returns:
            dict: Created thread document
        
        Raises:
            ValueError: If thread relationship already exists
        """
        try:
            doc = {
                'parent_id': ObjectId(parent_id),
                'reply_id': ObjectId(reply_id),
                'created_at': datetime.utcnow()
            }
            
            result = self.collection.insert_one(doc)
            
            return {
                'id': str(result.inserted_id),
                'parent_id': parent_id,
                'reply_id': reply_id,
                'created_at': doc['created_at'].isoformat()
            }
        except Exception as e:
            if 'duplicate key' in str(e).lower():
                raise ValueError('Thread relationship already exists')
            raise e
    
    def get_replies(self, parent_id: str, skip: int = 0, limit: int = 50) -> List[str]:
        """
        Get all reply IDs for a parent message.
        
        Args:
            parent_id: Parent message ID
            skip: Number of replies to skip (pagination)
            limit: Maximum replies to return
        
        Returns:
            list: List of reply message IDs
        """
        try:
            threads = self.collection.find({
                'parent_id': ObjectId(parent_id)
            }).sort('created_at', 1).skip(skip).limit(limit)
            
            return [str(t['reply_id']) for t in threads]
        except Exception:
            return []
    
    def count_replies(self, parent_id: str) -> int:
        """
        Count total replies for a parent message.
        
        Args:
            parent_id: Parent message ID
        
        Returns:
            int: Number of replies
        """
        try:
            return self.collection.count_documents({'parent_id': ObjectId(parent_id)})
        except Exception:
            return 0
    
    def get_parent(self, reply_id: str) -> Optional[str]:
        """
        Get parent message ID for a reply.
        
        Args:
            reply_id: Reply message ID
        
        Returns:
            str: Parent message ID or None
        """
        try:
            doc = self.collection.find_one({'reply_id': ObjectId(reply_id)})
            return str(doc['parent_id']) if doc else None
        except Exception:
            return None
    
    def delete_reply(self, parent_id: str, reply_id: str) -> bool:
        """
        Delete a thread relationship.
        
        Args:
            parent_id: Parent message ID
            reply_id: Reply message ID
        
        Returns:
            bool: True if successful
        """
        try:
            result = self.collection.delete_one({
                'parent_id': ObjectId(parent_id),
                'reply_id': ObjectId(reply_id)
            })
            return result.deleted_count > 0
        except Exception:
            return False
    
    def delete_thread(self, parent_id: str) -> int:
        """
        Delete entire thread (all replies to parent).
        
        Args:
            parent_id: Parent message ID
        
        Returns:
            int: Number of relationships deleted
        """
        try:
            result = self.collection.delete_many({'parent_id': ObjectId(parent_id)})
            return result.deleted_count
        except Exception:
            return 0
    
    def get_thread_stats(self, parent_id: str) -> Dict[str, Any]:
        """
        Get statistics about a thread.
        
        Args:
            parent_id: Parent message ID
        
        Returns:
            dict: Thread statistics
        """
        try:
            reply_count = self.count_replies(parent_id)
            
            # Get first and last reply timestamps
            first_reply = self.collection.find_one(
                {'parent_id': ObjectId(parent_id)},
                sort=[('created_at', 1)]
            )
            
            last_reply = self.collection.find_one(
                {'parent_id': ObjectId(parent_id)},
                sort=[('created_at', -1)]
            )
            
            return {
                'parent_id': parent_id,
                'reply_count': reply_count,
                'first_reply_at': first_reply['created_at'].isoformat() if first_reply else None,
                'last_reply_at': last_reply['created_at'].isoformat() if last_reply else None
            }
        except Exception:
            return {
                'parent_id': parent_id,
                'reply_count': 0,
                'first_reply_at': None,
                'last_reply_at': None
            }
    
    def get_active_threads(self, channel_id: str, messages_collection, 
                          limit: int = 20) -> List[Dict[str, Any]]:
        """
        Get most active threads in a channel.
        
        Args:
            channel_id: Channel ID
            messages_collection: MongoDB messages collection
            limit: Maximum threads to return
        
        Returns:
            list: List of thread statistics
        """
        try:
            # Aggregate to find threads with most replies
            pipeline = [
                {
                    '$group': {
                        '_id': '$parent_id',
                        'reply_count': {'$sum': 1},
                        'last_reply_at': {'$max': '$created_at'}
                    }
                },
                {
                    '$sort': {'reply_count': -1}
                },
                {
                    '$limit': limit
                }
            ]
            
            threads = list(self.collection.aggregate(pipeline))
            
            # Get parent message details
            results = []
            for thread in threads:
                parent_id = str(thread['_id'])
                parent_msg = messages_collection.find_one({'_id': thread['_id']})
                
                if parent_msg:
                    results.append({
                        'parent_id': parent_id,
                        'reply_count': thread['reply_count'],
                        'last_reply_at': thread['last_reply_at'].isoformat(),
                        'parent_text': parent_msg.get('content', '')[:100]
                    })
            
            return results
        except Exception:
            return []
