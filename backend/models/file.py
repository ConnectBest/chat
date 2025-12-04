"""
File Model

Tracks uploaded files separately for better management, quotas, and reusability.
Files can be attached to messages via MESSAGE_FILES junction table.
"""

from datetime import datetime
from bson.objectid import ObjectId
from typing import Optional, Dict, Any, List
import os


class File:
    """
    File Model for managing uploaded files.
    
    Collection: 'files'
    
    Fields:
        - _id: MongoDB ObjectId (unique identifier)
        - filename: Original filename
        - mime_type: File MIME type (e.g., 'image/png')
        - size_bytes: File size in bytes
        - storage_url: Full URL or path to stored file
        - storage_key: Storage identifier (for S3/Cloudinary)
        - status: 'uploading' | 'ready' | 'deleted'
        - uploaded_by: User ID who uploaded
        - created_at: Upload timestamp
        - deleted_at: Soft delete timestamp
    """
    
    COLLECTION = 'files'
    
    # Valid file statuses
    STATUSES = ['uploading', 'ready', 'deleted']
    
    # Allowed MIME types
    ALLOWED_TYPES = {
        'image': ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
        'document': ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'text/plain', 'text/csv'],
        'archive': ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'],
        'video': ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
        'audio': ['audio/mpeg', 'audio/wav', 'audio/ogg']
    }
    
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    
    def __init__(self, db):
        """Initialize File model with database connection."""
        self.collection = db[self.COLLECTION]
        self._create_indexes()
    
    def _create_indexes(self):
        """Create indexes for efficient queries."""
        self.collection.create_index([('storage_url', 1)])
        self.collection.create_index([('uploaded_by', 1)])
        self.collection.create_index([('status', 1)])
        self.collection.create_index([('created_at', -1)])
        self.collection.create_index([('mime_type', 1)])
    
    def create(self, file_data: Dict[str, Any]) -> str:
        """
        Create a new file record.
        
        Args:
            file_data: Dictionary containing:
                - filename: Original filename (required)
                - mime_type: MIME type (required)
                - size_bytes: File size (required)
                - storage_url: Storage URL (required)
                - storage_key: Storage key (optional)
                - uploaded_by: User ID (required)
                - status: Status (default: 'uploading')
        
        Returns:
            str: Created file's ID
        
        Raises:
            ValueError: If validation fails
        """
        # Validate required fields
        required = ['filename', 'mime_type', 'size_bytes', 'storage_url', 'uploaded_by']
        for field in required:
            if field not in file_data:
                raise ValueError(f'Missing required field: {field}')
        
        # Validate file size
        if file_data['size_bytes'] > self.MAX_FILE_SIZE:
            raise ValueError(f'File size exceeds maximum allowed ({self.MAX_FILE_SIZE} bytes)')
        
        # Validate MIME type
        mime_type = file_data['mime_type']
        allowed = [mime for types in self.ALLOWED_TYPES.values() for mime in types]
        if mime_type not in allowed:
            raise ValueError(f'File type not allowed: {mime_type}')
        
        # Validate status
        status = file_data.get('status', 'uploading')
        if status not in self.STATUSES:
            raise ValueError(f'Invalid status. Must be one of: {self.STATUSES}')
        
        # Create file document
        file_doc = {
            'filename': file_data['filename'],
            'mime_type': mime_type,
            'size_bytes': file_data['size_bytes'],
            'storage_url': file_data['storage_url'],
            'storage_key': file_data.get('storage_key'),
            'status': status,
            'uploaded_by': ObjectId(file_data['uploaded_by']),
            'created_at': datetime.utcnow(),
            'deleted_at': None
        }
        
        result = self.collection.insert_one(file_doc)
        return str(result.inserted_id)
    
    def find_by_id(self, file_id: str) -> Optional[Dict[str, Any]]:
        """Find a file by ID."""
        try:
            file_doc = self.collection.find_one({
                '_id': ObjectId(file_id),
                'deleted_at': None
            })
            return self._format_file(file_doc) if file_doc else None
        except Exception:
            return None
    
    def update_status(self, file_id: str, status: str) -> bool:
        """
        Update file status.
        
        Args:
            file_id: File ID
            status: New status ('uploading', 'ready', 'deleted')
        
        Returns:
            bool: True if successful
        """
        if status not in self.STATUSES:
            raise ValueError(f'Invalid status. Must be one of: {self.STATUSES}')
        
        try:
            result = self.collection.update_one(
                {'_id': ObjectId(file_id)},
                {'$set': {'status': status}}
            )
            return result.modified_count > 0
        except Exception:
            return False
    
    def soft_delete(self, file_id: str) -> bool:
        """
        Soft delete a file (mark as deleted).
        
        Args:
            file_id: File ID
        
        Returns:
            bool: True if successful
        """
        try:
            result = self.collection.update_one(
                {'_id': ObjectId(file_id)},
                {
                    '$set': {
                        'status': 'deleted',
                        'deleted_at': datetime.utcnow()
                    }
                }
            )
            return result.modified_count > 0
        except Exception:
            return False
    
    def get_user_files(self, user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Get all files uploaded by a user.
        
        Args:
            user_id: User ID
            limit: Maximum number of files to return
        
        Returns:
            list: List of file documents
        """
        files = self.collection.find({
            'uploaded_by': ObjectId(user_id),
            'deleted_at': None
        }).sort('created_at', -1).limit(limit)
        
        return [self._format_file(f) for f in files]
    
    def get_user_storage_usage(self, user_id: str) -> int:
        """
        Calculate total storage used by a user.
        
        Args:
            user_id: User ID
        
        Returns:
            int: Total bytes used
        """
        pipeline = [
            {
                '$match': {
                    'uploaded_by': ObjectId(user_id),
                    'deleted_at': None,
                    'status': {'$ne': 'deleted'}
                }
            },
            {
                '$group': {
                    '_id': None,
                    'total_bytes': {'$sum': '$size_bytes'}
                }
            }
        ]
        
        result = list(self.collection.aggregate(pipeline))
        return result[0]['total_bytes'] if result else 0
    
    def cleanup_orphaned_files(self, days: int = 7) -> int:
        """
        Mark files in 'uploading' status for more than X days as deleted.
        
        Args:
            days: Number of days after which to clean up
        
        Returns:
            int: Number of files cleaned up
        """
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        result = self.collection.update_many(
            {
                'status': 'uploading',
                'created_at': {'$lt': cutoff}
            },
            {
                '$set': {
                    'status': 'deleted',
                    'deleted_at': datetime.utcnow()
                }
            }
        )
        
        return result.modified_count
    
    def _format_file(self, file_doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Format file document for API response."""
        if not file_doc:
            return None
        
        file_doc['id'] = str(file_doc['_id'])
        file_doc.pop('_id', None)
        
        # Convert ObjectId to string
        if 'uploaded_by' in file_doc:
            file_doc['uploaded_by'] = str(file_doc['uploaded_by'])
        
        # Convert datetime to ISO format
        for field in ['created_at', 'deleted_at']:
            if field in file_doc and file_doc[field]:
                file_doc[field] = file_doc[field].isoformat()
        
        return file_doc


from datetime import timedelta
