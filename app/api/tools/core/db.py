import os
import threading
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from sentence_transformers import SentenceTransformer
from groq import Groq
from dotenv import load_dotenv

load_dotenv()


class Database:
    """Thread-safe singleton database manager."""
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                # Double-check locking pattern
                if cls._instance is None:
                    cls._instance = super(Database, cls).__new__(cls)
                    cls._instance.client = None
                    cls._instance.db = None
                    cls._instance.embedding_model = None
                    cls._instance.groq_client = None
                    cls._instance.initialized = False
                    cls._instance._init_lock = threading.Lock()
        return cls._instance

    def initialize(self):
        """Initialize all database connections. Thread-safe."""
        with self._init_lock:
            if self.initialized:
                return True
            
            success = True
            mongo_uri = os.getenv("MONGO_URI")
            groq_api_key = os.getenv("GROQ_API_KEY")
            
            # MongoDB
            if mongo_uri:
                try:
                    self.client = MongoClient(
                        mongo_uri, 
                        server_api=ServerApi('1'),
                        serverSelectionTimeoutMS=5000  # 5 second timeout
                    )
                    # Test the connection
                    self.client.admin.command('ping')
                    self.db = self.client["connectbest_chat"]
                    print("✅ Database: Connected to MongoDB")
                except Exception as e:
                    print(f"❌ Database: MongoDB connection failed: {e}")
                    self.client = None
                    self.db = None
                    success = False
            else:
                print("⚠️  Database: MONGO_URI not set")
                success = False
            
            # Embedding Model
            try:
                print("📦 Database: Loading embedding model...")
                self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
                print("✅ Database: Embedding model loaded")
            except Exception as e:
                print(f"❌ Database: Failed to load embedding model: {e}")
                self.embedding_model = None
            
            # Groq Client
            if groq_api_key:
                try:
                    self.groq_client = Groq(api_key=groq_api_key)
                    print("✅ Database: Groq client initialized")
                except Exception as e:
                    print(f"❌ Database: Groq client failed: {e}")
                    self.groq_client = None
            else:
                print("⚠️  Database: GROQ_API_KEY not set")
                
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

    def get_groq_client(self):
        """Get Groq LLM client instance."""
        if not self.initialized:
            self.initialize()
        return self.groq_client
    
    def is_connected(self) -> bool:
        """Check if MongoDB is connected."""
        if self.client is None:
            return False
        try:
            self.client.admin.command('ping')
            return True
        except Exception:
            return False
    
    def reconnect(self) -> bool:
        """Attempt to reconnect to MongoDB."""
        with self._init_lock:
            self.initialized = False
            self.client = None
            self.db = None
        return self.initialize()


# Global instance
db_instance = Database()
