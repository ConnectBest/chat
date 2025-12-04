"""
Database Schema Setup Script

Initializes all collections and indexes for the enhanced schema.
Run this once to set up the new collections without affecting existing data.

Usage:
    python setup_enhanced_schema.py
"""

import os
import sys
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# MongoDB connection
MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
DATABASE_NAME = os.getenv('DATABASE_NAME', 'chatapp')

def setup_collections(db):
    """
    Create new collections and indexes.
    This is idempotent - safe to run multiple times.
    """
    print("🚀 Setting up enhanced MongoDB schema...\n")
    
    existing_collections = db.list_collection_names()
    print(f"📊 Existing collections: {', '.join(existing_collections)}\n")
    
    # ========================================================================
    # 1. FILES COLLECTION
    # ========================================================================
    print("📁 Setting up FILES collection...")
    if 'files' not in existing_collections:
        db.create_collection('files')
        print("   ✅ Created 'files' collection")
    else:
        print("   ℹ️  'files' collection already exists")
    
    # Create indexes
    files = db['files']
    files.create_index([('storage_url', 1)])
    files.create_index([('uploaded_by', 1)])
    files.create_index([('status', 1)])
    files.create_index([('created_at', -1)])
    files.create_index([('mime_type', 1)])
    print("   ✅ Created indexes for 'files'\n")
    
    # ========================================================================
    # 2. MESSAGE_FILES JUNCTION TABLE
    # ========================================================================
    print("🔗 Setting up MESSAGE_FILES junction table...")
    if 'message_files' not in existing_collections:
        db.create_collection('message_files')
        print("   ✅ Created 'message_files' collection")
    else:
        print("   ℹ️  'message_files' collection already exists")
    
    message_files = db['message_files']
    message_files.create_index(
        [('message_id', 1), ('file_id', 1)],
        unique=True
    )
    message_files.create_index([('message_id', 1)])
    message_files.create_index([('file_id', 1)])
    print("   ✅ Created indexes for 'message_files'\n")
    
    # ========================================================================
    # 3. MESSAGE_EMBEDDINGS COLLECTION (AI)
    # ========================================================================
    print("🤖 Setting up MESSAGE_EMBEDDINGS collection (AI)...")
    if 'message_embeddings' not in existing_collections:
        db.create_collection('message_embeddings')
        print("   ✅ Created 'message_embeddings' collection")
    else:
        print("   ℹ️  'message_embeddings' collection already exists")
    
    embeddings = db['message_embeddings']
    embeddings.create_index([('message_id', 1)], unique=True)
    embeddings.create_index([('author_id', 1)])
    embeddings.create_index([('channel_id', 1)])
    embeddings.create_index([('created_at', -1)])
    print("   ✅ Created indexes for 'message_embeddings'")
    print("   ⚠️  Note: Vector search index must be created in MongoDB Atlas UI\n")
    
    # ========================================================================
    # 4. THREADS COLLECTION
    # ========================================================================
    print("💬 Setting up THREADS collection...")
    if 'threads' not in existing_collections:
        db.create_collection('threads')
        print("   ✅ Created 'threads' collection")
    else:
        print("   ℹ️  'threads' collection already exists")
    
    threads = db['threads']
    threads.create_index(
        [('parent_id', 1), ('reply_id', 1)],
        unique=True
    )
    threads.create_index([('parent_id', 1), ('created_at', 1)])
    threads.create_index([('reply_id', 1)])
    print("   ✅ Created indexes for 'threads'\n")
    
    # ========================================================================
    # 5. REACTIONS COLLECTION
    # ========================================================================
    print("😊 Setting up REACTIONS collection...")
    if 'reactions' not in existing_collections:
        db.create_collection('reactions')
        print("   ✅ Created 'reactions' collection")
    else:
        print("   ℹ️  'reactions' collection already exists")
    
    reactions = db['reactions']
    reactions.create_index(
        [('message_id', 1), ('user_id', 1)],
        unique=True
    )
    reactions.create_index([('message_id', 1)])
    reactions.create_index([('user_id', 1)])
    reactions.create_index([('message_id', 1), ('emoji', 1)])
    print("   ✅ Created indexes for 'reactions'\n")
    
    # ========================================================================
    # 6. UPDATE CHANNELS - ADD ARCHIVE FIELDS
    # ========================================================================
    print("📝 Updating CHANNELS collection...")
    channels = db['channels']
    
    # Add archive fields to existing channels (if they don't have them)
    result = channels.update_many(
        {'archived_at': {'$exists': False}},
        {'$set': {'archived_at': None, 'archived_by': None}}
    )
    
    if result.modified_count > 0:
        print(f"   ✅ Added archive fields to {result.modified_count} channels")
    else:
        print("   ℹ️  All channels already have archive fields")
    print()
    
    # ========================================================================
    # SUMMARY
    # ========================================================================
    print("=" * 70)
    print("✅ SCHEMA SETUP COMPLETE!")
    print("=" * 70)
    print("\n📊 Collection Status:")
    all_collections = db.list_collection_names()
    
    new_collections = ['files', 'message_files', 'message_embeddings', 'threads', 'reactions']
    for coll in new_collections:
        status = "✅ Ready" if coll in all_collections else "❌ Missing"
        count = db[coll].count_documents({}) if coll in all_collections else 0
        print(f"   {status}  {coll:25s} ({count} documents)")
    
    print("\n📋 Your existing collections remain unchanged:")
    existing = ['users', 'channels', 'channel_members', 'messages', 'user_channel_reads']
    for coll in existing:
        if coll in all_collections:
            count = db[coll].count_documents({})
            print(f"   ✅      {coll:25s} ({count} documents)")
    
    print("\n" + "=" * 70)
    print("🎉 Your database is now ready for enhanced features!")
    print("=" * 70)
    print("\n📌 Next Steps:")
    print("   1. ✅ Schema is ready - no data migration needed")
    print("   2. 🤖 Install AI dependencies: pip install sentence-transformers")
    print("   3. 📁 Update file upload routes to use new File model")
    print("   4. 🔗 Update message creation to use MESSAGE_FILES junction")
    print("   5. 🧵 Update thread replies to use THREADS collection")
    print("   6. 😊 Update reactions to use REACTIONS collection")
    print("   7. 🎨 Start building AI features with MESSAGE_EMBEDDINGS")
    print("\n✨ All new features are opt-in - existing code works as-is!\n")


def verify_connection(client, db):
    """Verify database connection and permissions."""
    try:
        # Ping the database
        client.admin.command('ping')
        print(f"✅ Connected to MongoDB: {DATABASE_NAME}\n")
        return True
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        return False


def main():
    """Main setup function."""
    print("\n" + "=" * 70)
    print("  🚀 ENHANCED DATABASE SCHEMA SETUP")
    print("=" * 70)
    print(f"\nDatabase: {DATABASE_NAME}")
    print(f"Connection: {MONGO_URI.split('@')[-1] if '@' in MONGO_URI else 'localhost'}\n")
    
    try:
        # Connect to MongoDB
        client = MongoClient(MONGO_URI)
        db = client[DATABASE_NAME]
        
        # Verify connection
        if not verify_connection(client, db):
            return 1
        
        # Setup collections
        setup_collections(db)
        
        return 0
        
    except Exception as e:
        print(f"\n❌ Error during setup: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        if 'client' in locals():
            client.close()


if __name__ == '__main__':
    sys.exit(main())
