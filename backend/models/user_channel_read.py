"""
User Channel Read Status Model

Tracks the last read message timestamp for each user in each channel/DM.
This enables unread message count calculation.
"""

from datetime import datetime
from bson.objectid import ObjectId
from typing import Optional, Dict, Any


class UserChannelRead:
    """
    Tracks when users last read messages in channels/DMs.
    
    Collection: 'user_channel_reads'
    
    Fields:
        - user_id: Reference to user
        - channel_id: Reference to channel or DM
        - last_read_at: Timestamp of last read
        - last_message_id: ID of last read message (optional)
    """
    
    COLLECTION = 'user_channel_reads'
    
    def __init__(self, db):
        self.collection = db[self.COLLECTION]
        # Create compound index for efficient lookups
        self.collection.create_index([('user_id', 1), ('channel_id', 1)], unique=True)
    
    def mark_as_read(self, user_id: str, channel_id: str, 
                     last_message_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Mark channel/DM as read for user at current time.
        
        Args:
            user_id: User ID
            channel_id: Channel or DM ID
            last_message_id: Optional last message ID read
        
        Returns:
            dict: Updated read status document
        """
        now = datetime.utcnow()
        
        read_doc = {
            'user_id': ObjectId(user_id),
            'channel_id': ObjectId(channel_id),
            'last_read_at': now,
            'last_message_id': ObjectId(last_message_id) if last_message_id else None,
            'updated_at': now
        }
        
        # Upsert: update if exists, insert if not
        result = self.collection.update_one(
            {
                'user_id': ObjectId(user_id),
                'channel_id': ObjectId(channel_id)
            },
            {'$set': read_doc},
            upsert=True
        )
        
        return {
            'user_id': user_id,
            'channel_id': channel_id,
            'last_read_at': now.isoformat(),
            'last_message_id': last_message_id
        }
    
    def get_last_read(self, user_id: str, channel_id: str) -> Optional[datetime]:
        """
        Get last read timestamp for user in channel.
        
        Args:
            user_id: User ID
            channel_id: Channel or DM ID
        
        Returns:
            datetime: Last read timestamp or None if never read
        """
        doc = self.collection.find_one({
            'user_id': ObjectId(user_id),
            'channel_id': ObjectId(channel_id)
        })
        
        return doc['last_read_at'] if doc else None
    
    def get_unread_count(self, user_id: str, channel_id: str, messages_collection) -> int:
        """
        Calculate unread message count for user in channel.
        
        Args:
            user_id: User ID
            channel_id: Channel or DM ID
            messages_collection: MongoDB messages collection
        
        Returns:
            int: Number of unread messages
        """
        last_read = self.get_last_read(user_id, channel_id)
        
        query = {
            'channel_id': ObjectId(channel_id),
            'is_deleted': False
        }
        
        # If user has read before, count messages after that time
        if last_read:
            query['created_at'] = {'$gt': last_read}
        
        # Don't count user's own messages as unread
        query['user_id'] = {'$ne': ObjectId(user_id)}
        
        return messages_collection.count_documents(query)
    
    def get_all_unread_counts(self, user_id: str, channel_ids: list, 
                               messages_collection) -> Dict[str, int]:
        """
        Get unread counts for multiple channels at once.
        
        Args:
            user_id: User ID
            channel_ids: List of channel IDs
            messages_collection: MongoDB messages collection
        
        Returns:
            dict: Map of channel_id -> unread_count
        """
        unread_counts = {}
        
        for channel_id in channel_ids:
            count = self.get_unread_count(user_id, channel_id, messages_collection)
            if count > 0:
                unread_counts[channel_id] = count
        
        return unread_counts
