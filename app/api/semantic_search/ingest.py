import os
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from sentence_transformers import SentenceTransformer
from pinecone import Pinecone, ServerlessSpec
from dotenv import load_dotenv
import time

load_dotenv()

# Configuration
MONGO_URI = os.getenv("MONGO_URI")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = "connectbest-chat"
PINECONE_NAMESPACE = "messages"

if not MONGO_URI or not PINECONE_API_KEY:
    raise ValueError("MONGO_URI and PINECONE_API_KEY must be set")

# Initialize Clients
mongo_client = MongoClient(MONGO_URI, server_api=ServerApi('1'))
db = mongo_client["connectbest_chat"]

pc = Pinecone(api_key=PINECONE_API_KEY)

# Create Index if not exists
if PINECONE_INDEX_NAME not in pc.list_indexes().names():
    print(f"Creating index {PINECONE_INDEX_NAME}...")
    pc.create_index(
        name=PINECONE_INDEX_NAME,
        dimension=384, # all-MiniLM-L6-v2 dimension
        metric="cosine",
        spec=ServerlessSpec(
            cloud="aws",
            region="us-east-1"
        )
    )
    time.sleep(10) # Wait for index to be ready

index = pc.Index(PINECONE_INDEX_NAME)

# Load Model
print("Loading model...")
model = SentenceTransformer('all-MiniLM-L6-v2')

def ingest_messages():
    print("Fetching messages from MongoDB...")
    # Fetch messages that have embeddings
    # Actually, we should fetch ALL messages and generate embeddings if missing, 
    # but for now let's assume we migrate existing embeddings or regenerate them.
    # The current system stores embeddings in 'message_embeddings' collection.
    
    pipeline = [
        {
            "$lookup": {
                "from": "messages",
                "localField": "message_id",
                "foreignField": "id",
                "as": "message"
            }
        },
        {"$unwind": "$message"},
        {
            "$lookup": {
                "from": "users",
                "localField": "message.author_id",
                "foreignField": "id",
                "as": "author"
            }
        },
        {"$unwind": "$author"},
        {
            "$lookup": {
                "from": "channels",
                "localField": "message.channel_id",
                "foreignField": "id",
                "as": "channel"
            }
        },
        {"$unwind": "$channel"},
        {
            "$project": {
                "message_id": 1,
                "text": "$message.text",
                "created_at": "$message.created_at",
                "author_name": "$author.display_name",
                "author_id": "$message.author_id",
                "channel_name": "$channel.name",
                "channel_id": "$message.channel_id"
            }
        }
    ]
    
    data = list(db.message_embeddings.aggregate(pipeline))
    print(f"Found {len(data)} messages to ingest.")
    
    batch_size = 100
    vectors = []
    
    for i, item in enumerate(data):
        # Generate embedding (or use stored one if we trust it, but let's regenerate to be safe/consistent)
        embedding = model.encode(item['text']).tolist()
        
        metadata = {
            "text": item['text'],
            "author_name": item['author_name'],
            "author_id": item['author_id'],
            "channel_name": item['channel_name'],
            "channel_id": item['channel_id'],
            "created_at": item['created_at'].isoformat() if hasattr(item['created_at'], 'isoformat') else str(item['created_at'])
        }
        
        vectors.append({
            "id": item['message_id'],
            "values": embedding,
            "metadata": metadata
        })
        
        if len(vectors) >= batch_size:
            print(f"Upserting batch {i//batch_size + 1}...")
            index.upsert(vectors=vectors, namespace=PINECONE_NAMESPACE)
            vectors = []
            
    if vectors:
        print("Upserting final batch...")
        index.upsert(vectors=vectors, namespace=PINECONE_NAMESPACE)
        
    print("Ingestion complete!")

if __name__ == "__main__":
    ingest_messages()
