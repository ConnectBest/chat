"""
Channel Model

This module defines the Channel model for MongoDB.
Handles chat channels/rooms where users can communicate.

LEARNING NOTE:
- Channels are like chat rooms or Slack channels
- Can be public (anyone can join) or private (invite-only)
- Tracks members and their roles (admin/member)
"""

from datetime import datetime
from bson.objectid import ObjectId
from typing import Optional, Dict, Any, List


class Channel:
    """
    Channel Model representing chat channels/rooms.
    
    Collections in MongoDB: 'channels', 'channel_members'
    
    Channel Fields:
        - _id: MongoDB ObjectId (unique identifier)
        - name: Channel name (unique, lowercase)
        - description: Channel description
        - type: 'public' or 'private'
        - created_by: User ID who created the channel
        - created_at: Creation timestamp
        - updated_at: Last update timestamp
    
    Channel Members Fields:
        - channel_id: Reference to channel
        - user_id: Reference to user
        - role: 'admin' or 'member'
        - joined_at: When user joined
        - last_read_at: Last time user read messages
    """
    
    # MongoDB collection names
    COLLECTION = 'channels'
    MEMBERS_COLLECTION = 'channel_members'
    
    # Valid channel types
    TYPES = ['public', 'private']
    
    # Valid member roles
    MEMBER_ROLES = ['admin', 'member']
    
    def __init__(self, db):
        """
        Initialize Channel model with database connection
        
        Args:
            db: MongoDB database instance
        """
        self.collection = db[self.COLLECTION]
        self.members_collection = db[self.MEMBERS_COLLECTION]
    
    def create(self, name: str, created_by: str, 
               description: Optional[str] = None, 
               channel_type: str = 'public') -> Dict[str, Any]:
        """
        Create a new channel.
        
        LEARNING NOTE:
        - Creator automatically becomes channel admin
        - Channel names are converted to lowercase and must be unique
        - Public channels can be joined by anyone
        - Private channels require invitation
        
        Args:
            name: Channel name (will be lowercase)
            created_by: User ID of creator
            description: Optional channel description
            channel_type: 'public' or 'private'
        
        Returns:
            dict: Created channel document
        
        Raises:
            ValueError: If validation fails
        """
        
        # Validate channel type
        if channel_type not in self.TYPES:
            raise ValueError(f'Invalid type. Must be one of: {self.TYPES}')
        
        # Normalize channel name
        channel_name = name.lower().strip().replace(' ', '-')
        
        # Check if channel name already exists
        if self.find_by_name(channel_name):
            raise ValueError('Channel with this name already exists')
        
        # Create channel document
        channel_doc = {
            'name': channel_name,
            'description': description,
            'type': channel_type,
            'created_by': ObjectId(created_by),
            'is_deleted': False,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        # Insert channel
        result = self.collection.insert_one(channel_doc)
        channel_id = result.inserted_id
        
        # Add creator as admin member
        self.add_member(str(channel_id), created_by, role='admin')
        
        # Return formatted channel
        channel_doc['_id'] = channel_id
        return self._format_channel(channel_doc)
    
    def find_by_id(self, channel_id: str) -> Optional[Dict[str, Any]]:
        """
        Find a channel by its ID.
        
        Args:
            channel_id: MongoDB ObjectId as string
        
        Returns:
            dict: Channel document or None if not found
        """
        try:
            channel = self.collection.find_one({
                '_id': ObjectId(channel_id),
                'is_deleted': False
            })
            return self._format_channel(channel) if channel else None
        except Exception:
            return None
    
    def find_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """
        Find a channel by its name.
        
        Args:
            name: Channel name
        
        Returns:
            dict: Channel document or None if not found
        """
        channel = self.collection.find_one({
            'name': name.lower().strip(),
            'is_deleted': False
        })
        return self._format_channel(channel) if channel else None
    
    def list_user_channels(self, user_id: str, skip: int = 0, 
                          limit: int = 50) -> List[Dict[str, Any]]:
        """
        List all channels a user is a member of.
        
        LEARNING NOTE:
        - Uses MongoDB aggregation pipeline
        - Joins channel_members with channels collection
        - Aggregation is like SQL JOIN operation
        
        Args:
            user_id: User ID
            skip: Number of documents to skip (pagination)
            limit: Maximum documents to return
        
        Returns:
            list: List of channel documents with member info
        """
        try:
            # Aggregation pipeline to join collections
            pipeline = [
                # Stage 1: Find channels user is member of
                {
                    '$match': {
                        'user_id': ObjectId(user_id)
                    }
                },
                # Stage 2: Join with channels collection
                {
                    '$lookup': {
                        'from': self.COLLECTION,
                        'localField': 'channel_id',
                        'foreignField': '_id',
                        'as': 'channel'
                    }
                },
                # Stage 3: Unwind array (convert array to document)
                {
                    '$unwind': '$channel'
                },
                # Stage 4: Filter out deleted channels
                {
                    '$match': {
                        'channel.is_deleted': False
                    }
                },
                # Stage 5: Sort by most recent
                {
                    '$sort': {'joined_at': -1}
                },
                # Stage 6: Skip for pagination
                {
                    '$skip': skip
                },
                # Stage 7: Limit results
                {
                    '$limit': limit
                },
                # Stage 8: Format output
                {
                    '$project': {
                        '_id': '$channel._id',
                        'name': '$channel.name',
                        'description': '$channel.description',
                        'type': '$channel.type',
                        'created_by': '$channel.created_by',
                        'created_at': '$channel.created_at',
                        'member_role': '$role',
                        'joined_at': '$joined_at'
                    }
                }
            ]
            
            channels = list(self.members_collection.aggregate(pipeline))
            return [self._format_channel(ch) for ch in channels]
        except Exception as e:
            print(f"Error listing channels: {e}")
            return []
    
    def list_public_channels(self, skip: int = 0, limit: int = 50) -> List[Dict[str, Any]]:
        """
        List all public channels.
        
        Args:
            skip: Number of documents to skip
            limit: Maximum documents to return
        
        Returns:
            list: List of public channel documents
        """
        channels = self.collection.find({
            'type': 'public',
            'is_deleted': False
        }).skip(skip).limit(limit).sort('created_at', -1)
        
        return [self._format_channel(ch) for ch in channels]
    
    def add_member(self, channel_id: str, user_id: str, 
                   role: str = 'member') -> bool:
        """
        Add a user as a member of a channel.
        
        Args:
            channel_id: Channel ID
            user_id: User ID to add
            role: Member role ('admin' or 'member')
        
        Returns:
            bool: True if successful, False otherwise
        """
        if role not in self.MEMBER_ROLES:
            raise ValueError(f'Invalid role. Must be one of: {self.MEMBER_ROLES}')
        
        try:
            # Check if member already exists
            existing = self.members_collection.find_one({
                'channel_id': ObjectId(channel_id),
                'user_id': ObjectId(user_id)
            })
            
            if existing:
                return False  # Already a member
            
            # Add member
            self.members_collection.insert_one({
                'channel_id': ObjectId(channel_id),
                'user_id': ObjectId(user_id),
                'role': role,
                'joined_at': datetime.utcnow(),
                'last_read_at': datetime.utcnow()
            })
            return True
        except Exception:
            return False
    
    def remove_member(self, channel_id: str, user_id: str) -> bool:
        """
        Remove a user from a channel.
        
        Args:
            channel_id: Channel ID
            user_id: User ID to remove
        
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            result = self.members_collection.delete_one({
                'channel_id': ObjectId(channel_id),
                'user_id': ObjectId(user_id)
            })
            return result.deleted_count > 0
        except Exception:
            return False
    
    def is_member(self, channel_id: str, user_id: str) -> bool:
        """
        Check if user is a member of channel.
        
        Args:
            channel_id: Channel ID
            user_id: User ID
        
        Returns:
            bool: True if user is member, False otherwise
        """
        try:
            member = self.members_collection.find_one({
                'channel_id': ObjectId(channel_id),
                'user_id': ObjectId(user_id)
            })
            return member is not None
        except Exception:
            return False
    
    def is_admin(self, channel_id: str, user_id: str) -> bool:
        """
        Check if user is an admin of channel.
        
        Args:
            channel_id: Channel ID
            user_id: User ID
        
        Returns:
            bool: True if user is admin, False otherwise
        """
        try:
            member = self.members_collection.find_one({
                'channel_id': ObjectId(channel_id),
                'user_id': ObjectId(user_id),
                'role': 'admin'
            })
            return member is not None
        except Exception:
            return False
    
    def get_members(self, channel_id: str) -> List[Dict[str, Any]]:
        """
        Get all members of a channel.
        
        Args:
            channel_id: Channel ID
        
        Returns:
            list: List of member documents with user info
        """
        try:
            # Aggregate to get member details with user info
            pipeline = [
                {
                    '$match': {
                        'channel_id': ObjectId(channel_id)
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
                {
                    '$unwind': '$user'
                },
                {
                    '$project': {
                        'user_id': {'$toString': '$user_id'},
                        'name': {'$ifNull': ['$user.full_name', {'$ifNull': ['$user.username', '$user.email']}]},
                        'email': '$user.email',
                        'avatar': '$user.avatar',
                        'status': {'$ifNull': ['$user.status', 'offline']},
                        'role': 1,
                        'joined_at': {'$dateToString': {'format': '%Y-%m-%dT%H:%M:%S.%LZ', 'date': '$joined_at'}}
                    }
                }
            ]
            
            members = list(self.members_collection.aggregate(pipeline))
            # Ensure all fields are properly formatted
            for member in members:
                if '_id' in member:
                    member.pop('_id', None)
            return members
        except Exception:
            return []
    
    def update(self, channel_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Update channel information.
        
        Args:
            channel_id: Channel ID
            updates: Dictionary of fields to update
        
        Returns:
            dict: Updated channel document or None if not found
        """
        updates['updated_at'] = datetime.utcnow()
        
        # Protected fields
        protected = ['_id', 'created_by', 'created_at']
        for field in protected:
            updates.pop(field, None)
        
        try:
            result = self.collection.find_one_and_update(
                {'_id': ObjectId(channel_id)},
                {'$set': updates},
                return_document=True
            )
            return self._format_channel(result) if result else None
        except Exception:
            return None
    
    def delete(self, channel_id: str) -> bool:
        """
        Soft delete a channel.
        
        Args:
            channel_id: Channel ID
        
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            result = self.collection.update_one(
                {'_id': ObjectId(channel_id)},
                {'$set': {'is_deleted': True, 'updated_at': datetime.utcnow()}}
            )
            return result.modified_count > 0
        except Exception:
            return False
    
    def _format_channel(self, channel: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        Format channel document for API response.
        
        Args:
            channel: Raw channel document
        
        Returns:
            dict: Formatted channel document
        """
        if not channel:
            return None
        
        # Convert ObjectIds to strings
        channel['id'] = str(channel['_id'])
        channel.pop('_id', None)
        
        if 'created_by' in channel and channel['created_by']:
            channel['created_by'] = str(channel['created_by'])
        
        # Format timestamps
        for field in ['created_at', 'updated_at', 'joined_at']:
            if field in channel and channel[field]:
                channel[field] = channel[field].isoformat()
        
        return channel
