"""
Database Initialization Script

This script initializes the MongoDB database with:
1. Required collections
2. Indexes for performance
3. Optional sample data for testing

Run this script once before starting the application:
    python init_db.py
"""

from pymongo import MongoClient, ASCENDING, DESCENDING, TEXT
from config import get_config
import sys

def init_database():
    """
    Initialize MongoDB database with collections and indexes.
    """
    
    print("🚀 Initializing MongoDB database...")
    
    # Load configuration
    config = get_config()
    
    try:
        # Connect to MongoDB
        print(f"📡 Connecting to MongoDB: {config.MONGODB_URI}")
        client = MongoClient(config.MONGODB_URI, serverSelectionTimeoutMS=5000)
        
        # Test connection
        client.server_info()
        print("✅ Connected to MongoDB successfully")
        
        # Get database
        db = client[config.MONGODB_DB_NAME]
        print(f"📂 Using database: {config.MONGODB_DB_NAME}")
        
        # Create collections and indexes
        
        # 1. Users Collection
        print("\n👤 Setting up 'users' collection...")
        users = db['users']
        users.create_index([('email', ASCENDING)], unique=True)
        users.create_index([('created_at', DESCENDING)])
        users.create_index([('status', ASCENDING)])
        users.create_index([('email', TEXT), ('name', TEXT)])  # Text search
        print("✅ Users collection configured")
        
        # 2. Channels Collection
        print("\n📢 Setting up 'channels' collection...")
        channels = db['channels']
        channels.create_index([('name', ASCENDING)], unique=True)
        channels.create_index([('type', ASCENDING)])
        channels.create_index([('created_by', ASCENDING)])
        channels.create_index([('created_at', DESCENDING)])
        print("✅ Channels collection configured")
        
        # 3. Channel Members Collection
        print("\n👥 Setting up 'channel_members' collection...")
        channel_members = db['channel_members']
        channel_members.create_index(
            [('channel_id', ASCENDING), ('user_id', ASCENDING)],
            unique=True
        )
        channel_members.create_index([('channel_id', ASCENDING)])
        channel_members.create_index([('user_id', ASCENDING)])
        print("✅ Channel members collection configured")
        
        # 4. Messages Collection
        print("\n💬 Setting up 'messages' collection...")
        messages = db['messages']
        messages.create_index([('channel_id', ASCENDING), ('created_at', DESCENDING)])
        messages.create_index([('user_id', ASCENDING)])
        messages.create_index([('parent_message_id', ASCENDING)])
        messages.create_index([('created_at', DESCENDING)])
        messages.create_index([('content', TEXT)])  # Text search
        print("✅ Messages collection configured")
        
        # 5. Message Reactions Collection
        print("\n❤️  Setting up 'message_reactions' collection...")
        reactions = db['message_reactions']
        reactions.create_index(
            [('message_id', ASCENDING), ('user_id', ASCENDING)],
            unique=True
        )
        reactions.create_index([('message_id', ASCENDING)])
        print("✅ Message reactions collection configured")
        
        print("\n✨ Database initialization completed successfully!")
        print("\n📊 Database Statistics:")
        print(f"   - Collections: {len(db.list_collection_names())}")
        print(f"   - Database: {config.MONGODB_DB_NAME}")
        
        # Ask if user wants to create sample data
        create_sample = input("\n🎯 Do you want to create sample data for testing? (y/n): ")
        
        if create_sample.lower() == 'y':
            create_sample_data(db)
        
        print("\n🎉 Setup complete! You can now run the application with:")
        print("   python app.py")
        
    except Exception as e:
        print(f"\n❌ Error initializing database: {str(e)}")
        print("\nPlease check:")
        print("1. MongoDB is running")
        print("2. Connection string in .env is correct")
        print("3. You have proper permissions")
        sys.exit(1)
    
    finally:
        client.close()


def create_sample_data(db):
    """
    Create sample data for testing.
    """
    
    print("\n📝 Creating sample data...")
    
    try:
        import bcrypt
        from bson.objectid import ObjectId
        from datetime import datetime
        
        # Sample users
        print("   Creating sample users...")
        users = db['users']
        
        # Admin user
        admin_password = bcrypt.hashpw(b'Admin123', bcrypt.gensalt()).decode('utf-8')
        admin = {
            'email': 'admin@example.com',
            'password_hash': admin_password,
            'name': 'Admin User',
            'phone': None,
            'role': 'admin',
            'status': 'offline',
            'status_message': None,
            'avatar_url': None,
            'email_verified': True,
            'preferences': {
                'notifications': True,
                'sound_enabled': True,
                'timezone': 'UTC'
            },
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'last_login': None,
            'deleted_at': None
        }
        
        # Regular user
        user_password = bcrypt.hashpw(b'User123', bcrypt.gensalt()).decode('utf-8')
        user = {
            'email': 'user@example.com',
            'password_hash': user_password,
            'name': 'Test User',
            'phone': None,
            'role': 'user',
            'status': 'offline',
            'status_message': None,
            'avatar_url': None,
            'email_verified': True,
            'preferences': {
                'notifications': True,
                'sound_enabled': True,
                'timezone': 'UTC'
            },
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'last_login': None,
            'deleted_at': None
        }
        
        # Insert users if they don't exist
        if not users.find_one({'email': admin['email']}):
            admin_id = users.insert_one(admin).inserted_id
            print(f"   ✅ Created admin user: admin@example.com (password: Admin123)")
        else:
            admin_id = users.find_one({'email': admin['email']})['_id']
            print("   ℹ️  Admin user already exists")
        
        if not users.find_one({'email': user['email']}):
            user_id = users.insert_one(user).inserted_id
            print(f"   ✅ Created test user: user@example.com (password: User123)")
        else:
            user_id = users.find_one({'email': user['email']})['_id']
            print("   ℹ️  Test user already exists")
        
        # Sample channels
        print("   Creating sample channels...")
        channels = db['channels']
        channel_members = db['channel_members']
        
        general_channel = {
            'name': 'general',
            'description': 'General discussion channel',
            'type': 'public',
            'created_by': admin_id,
            'is_deleted': False,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        if not channels.find_one({'name': 'general'}):
            general_id = channels.insert_one(general_channel).inserted_id
            print("   ✅ Created 'general' channel")
            
            # Add both users as members
            channel_members.insert_many([
                {
                    'channel_id': general_id,
                    'user_id': admin_id,
                    'role': 'admin',
                    'joined_at': datetime.utcnow(),
                    'last_read_at': datetime.utcnow()
                },
                {
                    'channel_id': general_id,
                    'user_id': user_id,
                    'role': 'member',
                    'joined_at': datetime.utcnow(),
                    'last_read_at': datetime.utcnow()
                }
            ])
            print("   ✅ Added users to 'general' channel")
            
            # Sample messages
            print("   Creating sample messages...")
            messages = db['messages']
            
            message1 = {
                'channel_id': general_id,
                'user_id': admin_id,
                'content': 'Welcome to the chat application!',
                'parent_message_id': None,
                'is_pinned': False,
                'is_edited': False,
                'is_deleted': False,
                'edited_at': None,
                'metadata': {'mentions': [], 'link_preview': None},
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            
            message2 = {
                'channel_id': general_id,
                'user_id': user_id,
                'content': 'Thanks! This looks great.',
                'parent_message_id': None,
                'is_pinned': False,
                'is_edited': False,
                'is_deleted': False,
                'edited_at': None,
                'metadata': {'mentions': [], 'link_preview': None},
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            
            messages.insert_many([message1, message2])
            print("   ✅ Created sample messages")
        else:
            print("   ℹ️  General channel already exists")
        
        print("\n✅ Sample data created successfully!")
        print("\n📧 Test Credentials:")
        print("   Admin: admin@example.com / Admin123")
        print("   User:  user@example.com / User123")
        
    except Exception as e:
        print(f"   ⚠️  Error creating sample data: {str(e)}")
        print("   You can still use the application, just create users manually")


if __name__ == '__main__':
    init_database()
