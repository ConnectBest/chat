#!/usr/bin/env python3
"""
Migration Script: Rename message_reactions to reactions

This script handles the migration from 'message_reactions' collection to 'reactions'.
It will:
1. Check if 'message_reactions' collection exists
2. If it exists and 'reactions' doesn't, rename it
3. If both exist, merge the data and remove duplicates
4. Create proper indexes on the 'reactions' collection

Usage:
    python scripts/migrate_reactions_collection.py
"""

import os
import sys
from pymongo import MongoClient, ASCENDING
from dotenv import load_dotenv
from bson.objectid import ObjectId

# Load environment variables
load_dotenv()

# MongoDB connection
MONGO_URI = os.getenv('MONGO_URI', os.getenv('MONGODB_URI', 'mongodb://localhost:27017/'))
DATABASE_NAME = os.getenv('DATABASE_NAME', os.getenv('MONGODB_DB_NAME', 'chatapp'))


def migrate_reactions_collection():
    """
    Migrate from message_reactions to reactions collection.
    """
    print("=" * 70)
    print("  REACTIONS COLLECTION MIGRATION")
    print("=" * 70)
    print(f"\nDatabase: {DATABASE_NAME}")
    print(f"Connection: {MONGO_URI.split('@')[-1] if '@' in MONGO_URI else 'localhost'}\n")
    
    try:
        # Connect to MongoDB
        client = MongoClient(MONGO_URI)
        db = client[DATABASE_NAME]
        
        # Verify connection
        client.admin.command('ping')
        print("✅ Connected to MongoDB successfully\n")
        
        # Get list of collections
        existing_collections = db.list_collection_names()
        
        has_message_reactions = 'message_reactions' in existing_collections
        has_reactions = 'reactions' in existing_collections
        
        print(f"📊 Current state:")
        print(f"   - 'message_reactions' collection exists: {has_message_reactions}")
        print(f"   - 'reactions' collection exists: {has_reactions}\n")
        
        # Case 1: Only message_reactions exists - simple rename
        if has_message_reactions and not has_reactions:
            print("🔄 Scenario: Renaming 'message_reactions' to 'reactions'...")
            
            # Count documents before
            count = db['message_reactions'].count_documents({})
            print(f"   Found {count} reactions to migrate")
            
            # Rename collection
            db['message_reactions'].rename('reactions')
            print("   ✅ Collection renamed successfully\n")
            
            # Verify rename
            if 'reactions' in db.list_collection_names():
                new_count = db['reactions'].count_documents({})
                print(f"   ✅ Verified: 'reactions' collection now has {new_count} documents\n")
            else:
                print("   ❌ Error: Rename failed\n")
                return 1
        
        # Case 2: Both collections exist - merge and deduplicate
        elif has_message_reactions and has_reactions:
            print("⚠️  Scenario: Both collections exist - merging data...")
            
            message_reactions = db['message_reactions']
            reactions = db['reactions']
            
            mr_count = message_reactions.count_documents({})
            r_count = reactions.count_documents({})
            
            print(f"   'message_reactions': {mr_count} documents")
            print(f"   'reactions': {r_count} documents\n")
            
            # Migrate documents from message_reactions to reactions
            migrated = 0
            duplicates = 0
            
            for doc in message_reactions.find():
                # Check if this reaction already exists in reactions collection
                existing = reactions.find_one({
                    'message_id': doc['message_id'],
                    'user_id': doc['user_id']
                })
                
                if existing:
                    duplicates += 1
                else:
                    # Insert into reactions
                    reactions.insert_one(doc)
                    migrated += 1
            
            print(f"   ✅ Migrated {migrated} unique reactions")
            print(f"   ℹ️  Skipped {duplicates} duplicates\n")
            
            # Drop the old collection
            if migrated > 0 or duplicates > 0:
                message_reactions.drop()
                print("   ✅ Dropped 'message_reactions' collection\n")
        
        # Case 3: Only reactions exists - nothing to do
        elif not has_message_reactions and has_reactions:
            print("✅ Scenario: Only 'reactions' collection exists")
            print("   Nothing to migrate - already using the correct collection\n")
        
        # Case 4: Neither exists - create reactions collection
        else:
            print("ℹ️  Scenario: Neither collection exists")
            print("   Creating 'reactions' collection with indexes...\n")
            db.create_collection('reactions')
        
        # Ensure proper indexes exist on reactions collection
        print("🔍 Setting up indexes on 'reactions' collection...")
        reactions = db['reactions']
        
        # Create indexes (idempotent)
        reactions.create_index(
            [('message_id', ASCENDING), ('user_id', ASCENDING)],
            unique=True,
            name='idx_message_user_unique'
        )
        reactions.create_index([('message_id', ASCENDING)], name='idx_message_id')
        reactions.create_index([('user_id', ASCENDING)], name='idx_user_id')
        reactions.create_index(
            [('message_id', ASCENDING), ('emoji', ASCENDING)],
            name='idx_message_emoji'
        )
        
        print("   ✅ Indexes created successfully\n")
        
        # Show final state
        final_count = reactions.count_documents({})
        print("=" * 70)
        print("✅ MIGRATION COMPLETE!")
        print("=" * 70)
        print(f"\n📊 Final state:")
        print(f"   'reactions' collection: {final_count} documents")
        
        # List indexes
        print(f"\n🔍 Indexes on 'reactions' collection:")
        for index in reactions.list_indexes():
            print(f"   - {index['name']}: {index.get('key', {})}")
        
        print("\n✨ The application is now using a unified 'reactions' collection!\n")
        
        return 0
        
    except Exception as e:
        print(f"\n❌ Error during migration: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        if 'client' in locals():
            client.close()


if __name__ == '__main__':
    sys.exit(migrate_reactions_collection())
