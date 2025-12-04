#!/usr/bin/env python3
"""
Schema Export Script

This script connects to your MongoDB database and exports sample documents
from each collection to help understand the schema structure.

Usage:
    python3 export_schema.py <mongodb_connection_string>
    
Example:
    python3 export_schema.py "mongodb+srv://user:pass@cluster.mongodb.net/dbname"
"""

import sys
from pymongo import MongoClient
from bson import json_util
import json

def export_schema(connection_string, database_name=None):
    """
    Connect to MongoDB and export sample documents from each collection
    
    Args:
        connection_string: MongoDB connection URI
        database_name: Optional database name (if not in connection string)
    """
    try:
        # Connect to MongoDB
        print(f"Connecting to MongoDB...")
        client = MongoClient(connection_string)
        
        # Get database
        if database_name:
            db = client[database_name]
        else:
            # Extract database from connection string or use default
            db = client.get_database()
        
        print(f"Connected to database: {db.name}")
        print("=" * 80)
        
        # Get all collections
        collections = db.list_collection_names()
        print(f"\nFound {len(collections)} collections:")
        for col in collections:
            print(f"  - {col}")
        
        print("\n" + "=" * 80)
        print("SCHEMA EXPORT")
        print("=" * 80)
        
        # Export sample documents from each collection
        schema_export = {}
        
        for collection_name in collections:
            print(f"\n📦 Collection: {collection_name}")
            print("-" * 80)
            
            collection = db[collection_name]
            
            # Get count
            count = collection.count_documents({})
            print(f"Total documents: {count}")
            
            if count > 0:
                # Get one sample document
                sample = collection.find_one()
                
                # Get field names and types
                print(f"\nFields:")
                if sample:
                    for field, value in sample.items():
                        field_type = type(value).__name__
                        print(f"  • {field}: {field_type}")
                        
                        # Show sample value for non-sensitive fields
                        if field not in ['password', 'password_hash', 'token', 'secret']:
                            if isinstance(value, str) and len(str(value)) > 50:
                                print(f"      Sample: {str(value)[:50]}...")
                            else:
                                print(f"      Sample: {value}")
                
                # Store in export
                schema_export[collection_name] = {
                    'count': count,
                    'sample_document': sample,
                    'fields': list(sample.keys()) if sample else []
                }
            else:
                print("  (Collection is empty)")
                schema_export[collection_name] = {
                    'count': 0,
                    'sample_document': None,
                    'fields': []
                }
        
        # Save to JSON file
        output_file = 'production_schema_export.json'
        with open(output_file, 'w') as f:
            json.dump(schema_export, f, default=json_util.default, indent=2)
        
        print("\n" + "=" * 80)
        print(f"✅ Schema exported to: {output_file}")
        print("=" * 80)
        print("\nYou can now share this file to create the schema adapter!")
        
        # Close connection
        client.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 export_schema.py <mongodb_connection_string> [database_name]")
        print("\nExample:")
        print('  python3 export_schema.py "mongodb+srv://user:pass@cluster.mongodb.net/chatapp"')
        sys.exit(1)
    
    connection_string = sys.argv[1]
    database_name = sys.argv[2] if len(sys.argv) > 2 else None
    
    export_schema(connection_string, database_name)
