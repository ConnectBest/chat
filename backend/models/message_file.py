"""
Message-File Junction Model

Links messages to files in a many-to-many relationship.
Allows files to be reused across multiple messages.
"""

from datetime import datetime
from bson.objectid import ObjectId
from typing import Optional, Dict, Any, List


class MessageFile:
    """
    Junction table linking messages to files.
    
    Collection: 'message_files'
    
    Fields:
        - message_id: Reference to message
        - file_id: Reference to file
        - created_at: When file was attached to message
    """
    
    COLLECTION = 'message_files'
    
    def __init__(self, db):
        """Initialize MessageFile model with database connection."""
        self.collection = db[self.COLLECTION]
        self._create_indexes()
    
    def _create_indexes(self):
        """Create indexes for efficient queries."""
        # Compound unique index: one file per message
        self.collection.create_index(
            [('message_id', 1), ('file_id', 1)],
            unique=True
        )
        # Index for finding all files in a message
        self.collection.create_index([('message_id', 1)])
        # Index for finding all messages using a file
        self.collection.create_index([('file_id', 1)])
    
    def attach_file(self, message_id: str, file_id: str) -> Dict[str, Any]:
        """
        Attach a file to a message.
        
        Args:
            message_id: Message ID
            file_id: File ID
        
        Returns:
            dict: Created junction document
        
        Raises:
            ValueError: If attachment already exists
        """
        try:
            doc = {
                'message_id': ObjectId(message_id),
                'file_id': ObjectId(file_id),
                'created_at': datetime.utcnow()
            }
            
            result = self.collection.insert_one(doc)
            
            return {
                'id': str(result.inserted_id),
                'message_id': message_id,
                'file_id': file_id,
                'created_at': doc['created_at'].isoformat()
            }
        except Exception as e:
            if 'duplicate key' in str(e).lower():
                raise ValueError('File already attached to this message')
            raise e
    
    def detach_file(self, message_id: str, file_id: str) -> bool:
        """
        Detach a file from a message.
        
        Args:
            message_id: Message ID
            file_id: File ID
        
        Returns:
            bool: True if successful
        """
        try:
            result = self.collection.delete_one({
                'message_id': ObjectId(message_id),
                'file_id': ObjectId(file_id)
            })
            return result.deleted_count > 0
        except Exception:
            return False
    
    def get_message_files(self, message_id: str, files_collection) -> List[Dict[str, Any]]:
        """
        Get all files attached to a message.
        
        Args:
            message_id: Message ID
            files_collection: MongoDB files collection for lookup
        
        Returns:
            list: List of file documents
        """
        try:
            # Find all file IDs for this message
            attachments = self.collection.find({'message_id': ObjectId(message_id)})
            file_ids = [att['file_id'] for att in attachments]
            
            if not file_ids:
                return []
            
            # Lookup file details
            from models.file import File
            file_model = File(files_collection.database)
            
            files = []
            for file_id in file_ids:
                file_doc = file_model.find_by_id(str(file_id))
                if file_doc:
                    files.append(file_doc)
            
            return files
        except Exception:
            return []
    
    def get_file_messages(self, file_id: str) -> List[str]:
        """
        Get all message IDs that use this file.
        
        Args:
            file_id: File ID
        
        Returns:
            list: List of message IDs
        """
        try:
            attachments = self.collection.find({'file_id': ObjectId(file_id)})
            return [str(att['message_id']) for att in attachments]
        except Exception:
            return []
    
    def delete_message_attachments(self, message_id: str) -> int:
        """
        Delete all file attachments for a message.
        
        Args:
            message_id: Message ID
        
        Returns:
            int: Number of attachments deleted
        """
        try:
            result = self.collection.delete_many({'message_id': ObjectId(message_id)})
            return result.deleted_count
        except Exception:
            return 0
    
    def count_file_usage(self, file_id: str) -> int:
        """
        Count how many messages use this file.
        
        Args:
            file_id: File ID
        
        Returns:
            int: Usage count
        """
        try:
            return self.collection.count_documents({'file_id': ObjectId(file_id)})
        except Exception:
            return 0
