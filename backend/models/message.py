"""
Message Model

This module defines the Message model for MongoDB.
Handles chat messages sent in channels.

LEARNING NOTE:
- Messages belong to channels and are sent by users
- Support for threads (replies to messages)
- Tracks edits, deletions, and reactions
"""

from datetime import datetime
from bson.objectid import ObjectId
from typing import Optional, Dict, Any, List
from models.reaction import Reaction
from models.thread import Thread


class Message:
    """
    Message Model representing chat messages.
    
    Collections in MongoDB: 'messages', 'reactions'
    
    Message Fields:
        - _id: MongoDB ObjectId (unique identifier)
        - channel_id: Reference to channel
        - user_id: Reference to user who sent
        - content: Message text
        - parent_message_id: For threaded replies (optional)
        - is_pinned: Whether message is pinned
        - is_edited: Whether message was edited
        - is_deleted: Soft delete flag
        - edited_at: Last edit timestamp
        - created_at: Sent timestamp
        - updated_at: Last update timestamp
    
    Reaction Fields:
        - message_id: Reference to message
        - user_id: User who reacted
        - emoji: Emoji character
        - created_at: Reaction timestamp
    """
    
    # MongoDB collection names
    COLLECTION = 'messages'
    REACTIONS_COLLECTION = 'reactions'
    
    def __init__(self, db):
        """
        Initialize Message model with database connection
        
        Args:
            db: MongoDB database instance
        """
        self.collection = db[self.COLLECTION]
        self.reactions_collection = db[self.REACTIONS_COLLECTION]
        self.reaction_model = Reaction(db)
        self.thread_model = Thread(db)
        self.db = db
    
    def create(self, channel_id: str, user_id: str, content: str,
               parent_message_id: Optional[str] = None,
               attachments: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Create a new message.
        
        LEARNING NOTE:
        - Messages are immutable once sent (can be edited but original is tracked)
        - parent_message_id creates threaded conversations
        - Timestamps use UTC to avoid timezone issues
        
        Args:
            channel_id: Channel ID where message is sent
            user_id: ID of user sending message
            content: Message text content
            parent_message_id: Optional parent message for threads
        
        Returns:
            dict: Created message document
        """
        
        # Create message document
        message_doc = {
            'channel_id': ObjectId(channel_id),
            'user_id': ObjectId(user_id),
            'content': content,
            'parent_message_id': ObjectId(parent_message_id) if parent_message_id else None,
            'is_pinned': False,
            'is_edited': False,
            'is_deleted': False,
            'edited_at': None,
            'attachments': attachments if attachments else [],
            'metadata': {
                'mentions': [],  # List of mentioned user IDs
                'link_preview': None
            },
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        # Insert message
        result = self.collection.insert_one(message_doc)
        message_doc['_id'] = result.inserted_id
        
        # If this is a reply, add to threads collection
        if parent_message_id:
            try:
                self.thread_model.add_reply(parent_message_id, str(result.inserted_id))
            except Exception as e:
                print(f"Warning: Failed to add thread relationship: {e}")
        
        return self._format_message(message_doc)
    
    def find_by_id(self, message_id: str) -> Optional[Dict[str, Any]]:
        """
        Find a message by its ID.
        
        Args:
            message_id: MongoDB ObjectId as string
        
        Returns:
            dict: Message document or None if not found
        """
        try:
            message = self.collection.find_one({
                '_id': ObjectId(message_id),
                'is_deleted': False
            })
            return self._format_message(message) if message else None
        except Exception:
            return None
    
    def list_channel_messages(self, channel_id: str, limit: int = 50,
                             before: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        List messages in a channel with pagination.
        
        LEARNING NOTE:
        - Uses cursor-based pagination (more efficient than skip/limit)
        - 'before' parameter gets messages older than given message ID
        - Returns newest messages first (reverse chronological)
        
        Args:
            channel_id: Channel ID
            limit: Maximum number of messages to return
            before: Message ID to paginate from (get older messages)
        
        Returns:
            list: List of message documents with user info
        """
        try:
            # Build query
            query = {
                'channel_id': ObjectId(channel_id),
                'is_deleted': False,
                'parent_message_id': None  # Only top-level messages (not thread replies)
            }
            
            # Add cursor pagination
            if before:
                query['_id'] = {'$lt': ObjectId(before)}
            
            # Aggregation pipeline to include user info
            pipeline = [
                {'$match': query},
                {'$sort': {'created_at': -1}},  # Newest first
                {'$limit': limit},
                # Join with users collection to get sender info
                {
                    '$lookup': {
                        'from': 'users',
                        'localField': 'user_id',
                        'foreignField': '_id',
                        'as': 'user'
                    }
                },
                {'$unwind': '$user'},
                # Format output
                {
                    '$project': {
                        '_id': 1,
                        'channel_id': 1,
                        'user_id': 1,
                        'content': 1,
                        'is_pinned': 1,
                        'is_edited': 1,
                        'edited_at': 1,
                        'metadata': 1,
                        'attachments': 1,
                        'created_at': 1,
                        'bookmarked_by': 1,
                        'user': {
                            '_id': '$user._id',
                            'name': '$user.name',
                            'email': '$user.email',
                            'avatar': '$user.avatar',
                            'status': '$user.status'
                        }
                    }
                }
            ]
            
            messages = list(self.collection.aggregate(pipeline))
            
            # Skip reactions for initial load - they'll be fetched only when messages have reactions
            # This makes message loading 10x faster
            formatted_messages = []
            for msg in messages:
                formatted_msg = self._format_message(msg)
                if formatted_msg:
                    # Set empty reactions array - frontend can fetch if needed
                    formatted_msg['reactions'] = []
                    formatted_messages.append(formatted_msg)
            return formatted_messages
        except Exception as e:
            print(f"Error listing messages: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    def get_thread_replies(self, parent_message_id: str) -> List[Dict[str, Any]]:
        """
        Get all replies to a message (thread).
        
        Args:
            parent_message_id: Parent message ID
        
        Returns:
            list: List of reply messages
        """
        try:
            pipeline = [
                {
                    '$match': {
                        'parent_message_id': ObjectId(parent_message_id),
                        'is_deleted': False
                    }
                },
                {'$sort': {'created_at': 1}},  # Oldest first for threads
                {
                    '$lookup': {
                        'from': 'users',
                        'localField': 'user_id',
                        'foreignField': '_id',
                        'as': 'user'
                    }
                },
                {'$unwind': '$user'},
                {
                    '$project': {
                        '_id': 1,
                        'channel_id': 1,
                        'user_id': 1,
                        'content': 1,
                        'is_edited': 1,
                        'edited_at': 1,
                        'created_at': 1,
                        'user': {
                            '_id': '$user._id',
                            'name': '$user.name',
                            'avatar': '$user.avatar',
                            'status': '$user.status'
                        }
                    }
                }
            ]
            
            replies = list(self.collection.aggregate(pipeline))
            return [self._format_message(msg) for msg in replies]
        except Exception:
            return []
    
    def update(self, message_id: str, content: str, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Update (edit) a message.
        
        LEARNING NOTE:
        - Only the message author can edit their message
        - Tracks that message was edited with timestamp
        - Original message is overwritten (could store history if needed)
        
        Args:
            message_id: Message ID to update
            content: New message content
            user_id: ID of user attempting to edit
        
        Returns:
            dict: Updated message or None if unauthorized/not found
        """
        try:
            # Verify user owns this message
            message = self.collection.find_one({
                '_id': ObjectId(message_id),
                'user_id': ObjectId(user_id),
                'is_deleted': False
            })
            
            if not message:
                return None  # Message not found or user doesn't own it
            
            # Update message
            result = self.collection.find_one_and_update(
                {'_id': ObjectId(message_id)},
                {
                    '$set': {
                        'content': content,
                        'is_edited': True,
                        'edited_at': datetime.utcnow(),
                        'updated_at': datetime.utcnow()
                    }
                },
                return_document=True
            )
            
            return self._format_message(result) if result else None
        except Exception:
            return None
    
    def delete(self, message_id: str, user_id: str) -> bool:
        """
        Soft delete a message.
        
        Args:
            message_id: Message ID to delete
            user_id: ID of user attempting to delete
        
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Verify user owns this message
            result = self.collection.update_one(
                {
                    '_id': ObjectId(message_id),
                    'user_id': ObjectId(user_id),
                    'is_deleted': False
                },
                {
                    '$set': {
                        'is_deleted': True,
                        'updated_at': datetime.utcnow()
                    }
                }
            )
            
            return result.modified_count > 0
        except Exception:
            return False
    
    def toggle_bookmark(self, message_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Toggle bookmark/star status on a message for a user.
        
        Args:
            message_id: Message ID to bookmark
            user_id: ID of user bookmarking
        
        Returns:
            dict: {'bookmarked': True/False} or None if message not found
        """
        try:
            # Check if message exists
            message = self.collection.find_one({
                '_id': ObjectId(message_id),
                'is_deleted': False
            })
            
            if not message:
                return None
            
            # Check if user already bookmarked this message
            bookmarks = message.get('bookmarked_by', [])
            user_obj_id = ObjectId(user_id)
            
            if user_obj_id in bookmarks:
                # Remove bookmark
                self.collection.update_one(
                    {'_id': ObjectId(message_id)},
                    {
                        '$pull': {'bookmarked_by': user_obj_id},
                        '$set': {'updated_at': datetime.utcnow()}
                    }
                )
                return {'bookmarked': False}
            else:
                # Add bookmark
                self.collection.update_one(
                    {'_id': ObjectId(message_id)},
                    {
                        '$addToSet': {'bookmarked_by': user_obj_id},
                        '$set': {'updated_at': datetime.utcnow()}
                    }
                )
                return {'bookmarked': True}
        except Exception:
            return None
    
    def pin(self, message_id: str) -> bool:
        """
        Pin a message in the channel.
        
        Args:
            message_id: Message ID to pin
        
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            result = self.collection.update_one(
                {'_id': ObjectId(message_id)},
                {'$set': {'is_pinned': True, 'updated_at': datetime.utcnow()}}
            )
            return result.modified_count > 0
        except Exception:
            return False
    
    def unpin(self, message_id: str) -> bool:
        """
        Unpin a message.
        
        Args:
            message_id: Message ID to unpin
        
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            result = self.collection.update_one(
                {'_id': ObjectId(message_id)},
                {'$set': {'is_pinned': False, 'updated_at': datetime.utcnow()}}
            )
            return result.modified_count > 0
        except Exception:
            return False
    
    def add_reaction(self, message_id: str, user_id: str, emoji: str) -> bool:
        """
        Add a reaction to a message using new Reaction model.
        
        LEARNING NOTE:
        - Users can have only one reaction per message
        - If user already reacted, replaces with new emoji
        
        Args:
            message_id: Message ID
            user_id: User ID
            emoji: Emoji character
        
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            self.reaction_model.add_reaction(message_id, user_id, emoji)
            return True
        except Exception as e:
            print(f"Error adding reaction: {e}")
            return False
    
    def remove_reaction(self, message_id: str, user_id: str) -> bool:
        """
        Remove a user's reaction from a message using new Reaction model.
        
        Args:
            message_id: Message ID
            user_id: User ID
        
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            return self.reaction_model.remove_reaction(message_id, user_id)
        except Exception:
            return False
    
    def get_reactions(self, message_id: str) -> List[Dict[str, Any]]:
        """
        Get all reactions for a message using new Reaction model.
        
        Args:
            message_id: Message ID
        
        Returns:
            list: List of reactions grouped by emoji with counts and user names
            Format: [{ emoji: "👍", count: 3, users: ["Alice", "Bob", "Charlie"] }]
        """
        try:
            return self.reaction_model.get_message_reactions(message_id)
        except Exception as e:
            print(f"Error in get_reactions: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    def get_thread_count(self, message_id: str) -> int:
        """
        Get the number of replies in a thread using new Thread model.
        
        Args:
            message_id: Parent message ID
        
        Returns:
            int: Number of replies
        """
        try:
            return self.thread_model.count_replies(message_id)
        except Exception:
            return 0
    
    def get_reactions_bulk(self, message_ids: List[ObjectId]) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get reactions for multiple messages in ONE database query (optimized for performance).
        
        Args:
            message_ids: List of message ObjectIds
        
        Returns:
            dict: Map of message_id (string) to reactions list
            Format: { "msg_id_1": [{ emoji: "👍", count: 3, users: [...] }], ... }
        """
        try:
            pipeline = [
                {
                    '$match': {
                        'message_id': {'$in': message_ids}
                    }
                },
                {
                    '$lookup': {
                        'from': 'users',
                        'localField': 'user_id',
                        'foreignField': '_id',
                        'as': 'user'
                    }
                },
                {'$unwind': '$user'},
                {
                    '$group': {
                        '_id': {
                            'message_id': '$message_id',
                            'emoji': '$emoji'
                        },
                        'count': {'$sum': 1},
                        'users': {'$push': '$user.name'}
                    }
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
            
            results = list(self.reactions_collection.aggregate(pipeline))
            
            # Convert to map: message_id -> reactions
            reactions_map = {}
            for result in results:
                msg_id = str(result['_id'])
                reactions_map[msg_id] = result['reactions']
            
            return reactions_map
        except Exception as e:
            print(f"Error in get_reactions_bulk: {e}")
            import traceback
            traceback.print_exc()
            return {}
    
    def search(self, channel_id: str, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Search messages in a channel.
        
        Args:
            channel_id: Channel ID to search in
            query: Search query
            limit: Maximum results
        
        Returns:
            list: Matching messages
        """
        try:
            # Text search using regex
            pipeline = [
                {
                    '$match': {
                        'channel_id': ObjectId(channel_id),
                        'content': {'$regex': query, '$options': 'i'},
                        'is_deleted': False
                    }
                },
                {'$sort': {'created_at': -1}},
                {'$limit': limit},
                {
                    '$lookup': {
                        'from': 'users',
                        'localField': 'user_id',
                        'foreignField': '_id',
                        'as': 'user'
                    }
                },
                {'$unwind': '$user'}
            ]
            
            messages = list(self.collection.aggregate(pipeline))
            return [self._format_message(msg) for msg in messages]
        except Exception:
            return []
    
    def _format_message(self, message: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        Format message document for API response.
        
        Args:
            message: Raw message document
        
        Returns:
            dict: Formatted message document
        """
        if not message:
            return None
        
        # Convert ObjectIds to strings
        message['id'] = str(message['_id'])
        message.pop('_id', None)
        
        # Convert ObjectId references
        if 'channel_id' in message:
            message['channel_id'] = str(message['channel_id'])
        
        if 'user_id' in message:
            message['user_id'] = str(message['user_id'])
        
        if message.get('parent_message_id'):
            message['parent_message_id'] = str(message['parent_message_id'])
        
        # Add bookmarked status - check if bookmarked_by array exists and has items
        if 'bookmarked_by' in message and isinstance(message['bookmarked_by'], list):
            message['bookmarked'] = len(message['bookmarked_by']) > 0
            # Convert bookmarked_by ObjectIds to strings for client
            message['bookmarked_by_users'] = [str(uid) for uid in message['bookmarked_by']]
        else:
            message['bookmarked'] = False
            message['bookmarked_by_users'] = []
        
        # Format user info if available
        if 'user' in message:
            user_data = message['user']
            message['user'] = {
                'id': str(user_data.get('_id', '')),
                'name': user_data.get('name', ''),
                'email': user_data.get('email', ''),
                'avatar': user_data.get('avatar'),
                'status': user_data.get('status', 'offline')
            }
        
        # Format dates
        if 'created_at' in message:
            message['created_at'] = message['created_at'].isoformat()
        
        if 'updated_at' in message:
            message['updated_at'] = message['updated_at'].isoformat()
        
        if message.get('edited_at'):
            message['edited_at'] = message['edited_at'].isoformat()
        
        # Remove internal fields
        message.pop('bookmarked_by', None)
        
        return message
