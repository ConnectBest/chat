#!/usr/bin/env python3
"""
MongoDB Schema Migration Script
Adds missing optional fields to production database
"""

from pymongo import MongoClient
from datetime import datetime
import sys

def migrate_schema(connection_string):
    """
    Add missing optional fields to production collections
    
    Args:
        connection_string: MongoDB Atlas connection URI
    """
    try:
        print("Connecting to MongoDB Atlas...")
        client = MongoClient(connection_string)
        db = client.get_database()
        
        print(f"Connected to database: {db.name}")
        print("=" * 80)
        
        # Migration 1: Add email verification fields to users
        print("\n📝 Migration 1: Adding email verification fields to users...")
        users_collection = db['users']
        
        result = users_collection.update_many(
            {'email_verified': {'$exists': False}},
            {
                '$set': {
                    'email_verified': False,
                    'verification_token': None,
                    'verification_expires': None
                }
            }
        )
        print(f"   ✅ Updated {result.modified_count} user documents")
        
        # Migration 2: Add attachments field to messages
        print("\n📝 Migration 2: Adding attachments field to messages...")
        messages_collection = db['messages']
        
        result = messages_collection.update_many(
            {'attachments': {'$exists': False}},
            {
                '$set': {
                    'attachments': []
                }
            }
        )
        print(f"   ✅ Updated {result.modified_count} message documents")
        
        # Migration 3: Add bookmarked_by field to messages
        print("\n📝 Migration 3: Adding bookmarked_by field to messages...")
        
        result = messages_collection.update_many(
            {'bookmarked_by': {'$exists': False}},
            {
                '$set': {
                    'bookmarked_by': []
                }
            }
        )
        print(f"   ✅ Updated {result.modified_count} message documents")
        
        print("\n" + "=" * 80)
        print("✅ MIGRATION COMPLETED SUCCESSFULLY!")
        print("=" * 80)
        print("\nAll missing optional fields have been added.")
        print("Your production database is now 100% compatible with your models.")
        
        client.close()
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 migrate_schema.py <mongodb_connection_string>")
        print("\nExample:")
        print('  python3 migrate_schema.py "mongodb+srv://user:pass@cluster.mongodb.net/chatapp"')
        sys.exit(1)
    
    connection_string = sys.argv[1]
    
    print("⚠️  WARNING: This will modify your production database!")
    print("=" * 80)
    response = input("Are you sure you want to continue? (yes/no): ")
    
    if response.lower() == 'yes':
        migrate_schema(connection_string)
    else:
        print("Migration cancelled.")
