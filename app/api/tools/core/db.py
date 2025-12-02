"""
Database Manager - Thread-safe singleton for MongoDB and Embedding Model
"""

import threading
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from sentence_transformers import SentenceTransformer

from .config import MONGO_URI, MONGO_DATABASE, EMBEDDING_MODEL


class Database:
    """Thread-safe singleton database manager."""
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(Database, cls).__new__(cls)
                    cls._instance.client = None
                    cls._instance.db = None
                    cls._instance.embedding_model = None
                    cls._instance.initialized = False
                    cls._instance._init_lock = threading.Lock()
        return cls._instance

    def initialize(self):
        """Initialize database connections. Thread-safe."""
        with self._init_lock:
            if self.initialized:
                return True
            
            success = True
            
            # MongoDB
            if MONGO_URI:
                try:
                    self.client = MongoClient(
                        MONGO_URI, 
                        server_api=ServerApi('1'),
                        serverSelectionTimeoutMS=5000
                    )
                    self.client.admin.command('ping')
                    self.db = self.client[MONGO_DATABASE]
                    print("✅ Database: Connected to MongoDB")
                except Exception as e:
                    print(f"❌ Database: MongoDB connection failed: {e}")
                    success = False
            else:
                print("⚠️  Database: MONGO_URI not set")
                success = False
            
            # Embedding Model
            try:
                print("📦 Database: Loading embedding model...")
                self.embedding_model = SentenceTransformer(EMBEDDING_MODEL)
                print("✅ Database: Embedding model loaded")
            except Exception as e:
                print(f"❌ Database: Failed to load embedding model: {e}")
                self.embedding_model = None
                
            self.initialized = True
            return success

    def get_db(self):
        """Get MongoDB database instance."""
        if not self.initialized:
            self.initialize()
        return self.db

    def get_embedding_model(self):
        """Get embedding model instance."""
        if not self.initialized:
            self.initialize()
        return self.embedding_model
    
    def is_connected(self) -> bool:
        """Check if MongoDB is connected."""
        if self.client is None:
            return False
        try:
            self.client.admin.command('ping')
            return True
        except Exception:
            return False


# Global singleton
db_instance = Database()
