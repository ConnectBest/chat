"""
Message Embedding Model

Stores vector embeddings of messages for AI semantic search.
Required for AI features like expert finder, semantic search, and jargon buster.
"""

from datetime import datetime
from bson.objectid import ObjectId
from typing import Optional, Dict, Any, List


class MessageEmbedding:
    """
    Message Embedding Model for AI/ML features.
    
    Collection: 'message_embeddings'
    
    Fields:
        - message_id: Reference to message (unique)
        - embedding: Vector embedding (384-dim for FastEmbed)
        - model: Embedding model name
        - dims: Embedding dimensions
        - author_id: Message author (for filtering)
        - channel_id: Channel ID (for scoped search)
        - created_at: When embedding was generated
    """
    
    COLLECTION = 'message_embeddings'
    
    # Default model settings
    DEFAULT_MODEL = 'BAAI/bge-small-en-v1.5'
    DEFAULT_DIMS = 384
    
    def __init__(self, db):
        """Initialize MessageEmbedding model with database connection."""
        self.collection = db[self.COLLECTION]
        self._create_indexes()
    
    def _create_indexes(self):
        """Create indexes for efficient queries."""
        # Unique index on message_id
        self.collection.create_index([('message_id', 1)], unique=True)
        
        # Index for author and channel filtering
        self.collection.create_index([('author_id', 1)])
        self.collection.create_index([('channel_id', 1)])
        self.collection.create_index([('created_at', -1)])
        
        # Vector search index (MongoDB Atlas Vector Search)
        # Note: This needs to be created via Atlas UI or API
        # Collection will work without it, but search will be slower
    
    def create(self, embedding_data: Dict[str, Any]) -> str:
        """
        Create a new embedding record.
        
        Args:
            embedding_data: Dictionary containing:
                - message_id: Message ID (required)
                - embedding: Vector array (required)
                - author_id: Author ID (required)
                - channel_id: Channel ID (required)
                - model: Model name (optional)
                - dims: Dimensions (optional)
        
        Returns:
            str: Created embedding's ID
        
        Raises:
            ValueError: If validation fails
        """
        # Validate required fields
        required = ['message_id', 'embedding', 'author_id', 'channel_id']
        for field in required:
            if field not in embedding_data:
                raise ValueError(f'Missing required field: {field}')
        
        # Validate embedding is a list of numbers
        embedding = embedding_data['embedding']
        if not isinstance(embedding, list):
            raise ValueError('Embedding must be a list of numbers')
        
        dims = len(embedding)
        
        # Create embedding document
        embedding_doc = {
            'message_id': ObjectId(embedding_data['message_id']),
            'embedding': embedding,
            'model': embedding_data.get('model', self.DEFAULT_MODEL),
            'dims': dims,
            'author_id': ObjectId(embedding_data['author_id']),
            'channel_id': ObjectId(embedding_data['channel_id']),
            'created_at': datetime.utcnow()
        }
        
        try:
            result = self.collection.insert_one(embedding_doc)
            return str(result.inserted_id)
        except Exception as e:
            if 'duplicate key' in str(e).lower():
                raise ValueError('Embedding already exists for this message')
            raise e
    
    def find_by_message_id(self, message_id: str) -> Optional[Dict[str, Any]]:
        """Find embedding by message ID."""
        try:
            doc = self.collection.find_one({'message_id': ObjectId(message_id)})
            return self._format_embedding(doc) if doc else None
        except Exception:
            return None
    
    def update_embedding(self, message_id: str, embedding: List[float]) -> bool:
        """
        Update embedding for a message.
        
        Args:
            message_id: Message ID
            embedding: New embedding vector
        
        Returns:
            bool: True if successful
        """
        try:
            result = self.collection.update_one(
                {'message_id': ObjectId(message_id)},
                {
                    '$set': {
                        'embedding': embedding,
                        'dims': len(embedding),
                        'created_at': datetime.utcnow()
                    }
                }
            )
            return result.modified_count > 0
        except Exception:
            return False
    
    def delete_by_message_id(self, message_id: str) -> bool:
        """
        Delete embedding for a message.
        
        Args:
            message_id: Message ID
        
        Returns:
            bool: True if successful
        """
        try:
            result = self.collection.delete_one({'message_id': ObjectId(message_id)})
            return result.deleted_count > 0
        except Exception:
            return False
    
    def search_similar(self, query_embedding: List[float], 
                      channel_ids: Optional[List[str]] = None,
                      limit: int = 10) -> List[Dict[str, Any]]:
        """
        Find similar messages using vector search.
        
        Note: This is a basic implementation. For production, use MongoDB Atlas
        Vector Search or a dedicated vector database like Pinecone.
        
        Args:
            query_embedding: Query vector
            channel_ids: Optional list of channel IDs to filter
            limit: Maximum results to return
        
        Returns:
            list: List of similar message embeddings with similarity scores
        """
        # Build query
        query = {}
        if channel_ids:
            query['channel_id'] = {'$in': [ObjectId(cid) for cid in channel_ids]}
        
        # Fetch all embeddings (filtered by channels)
        # In production, use vector search index for better performance
        embeddings = list(self.collection.find(query))
        
        # Calculate cosine similarity
        results = []
        for doc in embeddings:
            similarity = self._cosine_similarity(query_embedding, doc['embedding'])
            doc['similarity_score'] = similarity
            results.append(doc)
        
        # Sort by similarity (highest first)
        results.sort(key=lambda x: x['similarity_score'], reverse=True)
        
        # Return top N results
        return [self._format_embedding(r) for r in results[:limit]]
    
    def get_channel_embeddings(self, channel_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get all embeddings for a channel.
        
        Args:
            channel_id: Channel ID
            limit: Maximum results
        
        Returns:
            list: List of embeddings
        """
        embeddings = self.collection.find({
            'channel_id': ObjectId(channel_id)
        }).sort('created_at', -1).limit(limit)
        
        return [self._format_embedding(e) for e in embeddings]
    
    def count_embeddings(self) -> int:
        """Get total number of embeddings."""
        return self.collection.count_documents({})
    
    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """
        Calculate cosine similarity between two vectors.
        
        Args:
            vec1: First vector
            vec2: Second vector
        
        Returns:
            float: Similarity score (0-1)
        """
        try:
            import math
            
            # Dot product
            dot_product = sum(a * b for a, b in zip(vec1, vec2))
            
            # Magnitudes
            magnitude1 = math.sqrt(sum(a * a for a in vec1))
            magnitude2 = math.sqrt(sum(b * b for b in vec2))
            
            # Cosine similarity
            if magnitude1 == 0 or magnitude2 == 0:
                return 0.0
            
            return dot_product / (magnitude1 * magnitude2)
        except Exception:
            return 0.0
    
    def _format_embedding(self, doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Format embedding document for API response."""
        if not doc:
            return None
        
        doc['id'] = str(doc['_id'])
        doc.pop('_id', None)
        
        # Convert ObjectIds to strings
        for field in ['message_id', 'author_id', 'channel_id']:
            if field in doc:
                doc[field] = str(doc[field])
        
        # Convert datetime to ISO format
        if 'created_at' in doc and doc['created_at']:
            doc['created_at'] = doc['created_at'].isoformat()
        
        return doc
