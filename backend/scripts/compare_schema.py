#!/usr/bin/env python3
"""
Schema Comparison Script
Compares production schema with model definitions to find missing fields
"""

# Expected fields from your models
EXPECTED_SCHEMA = {
    'users': {
        'required': [
            '_id', 'email', 'username', 'password_hash', 'full_name', 'role', 
            'status', 'created_at', 'updated_at'
        ],
        'optional': [
            'avatar', 'email_verified', 'verification_token', 'verification_expires',
            'two_factor_enabled', 'two_factor_secret', 'backup_codes',
            'google_id', 'oauth_provider', 'last_login', 'status_message', 'name'
        ]
    },
    'channels': {
        'required': [
            '_id', 'name', 'type', 'created_by', 'created_at', 'updated_at', 'is_deleted'
        ],
        'optional': ['description']
    },
    'messages': {
        'required': [
            '_id', 'channel_id', 'user_id', 'content', 'is_pinned', 'is_edited',
            'is_deleted', 'created_at', 'updated_at'
        ],
        'optional': [
            'parent_message_id', 'edited_at', 'metadata', 'attachments', 'bookmarked_by'
        ]
    },
    'channel_members': {
        'required': ['_id', 'channel_id', 'user_id', 'role', 'joined_at'],
        'optional': ['last_read_at']
    },
    'reactions': {
        'required': ['_id', 'message_id', 'user_id', 'emoji', 'created_at'],
        'optional': []
    }
}

# Production schema (from export)
PRODUCTION_SCHEMA = {
    'users': [
        '_id', 'email', 'username', 'password_hash', 'full_name', 'role',
        'status', 'two_factor_enabled', 'two_factor_secret', 'backup_codes',
        'google_id', 'oauth_provider', 'created_at', 'updated_at',
        'last_login', 'status_message', 'avatar', 'name'
    ],
    'channels': [
        '_id', 'name', 'description', 'type', 'created_by', 'is_deleted',
        'created_at', 'updated_at'
    ],
    'messages': [
        '_id', 'channel_id', 'user_id', 'content', 'parent_message_id',
        'is_pinned', 'is_edited', 'is_deleted', 'edited_at', 'metadata',
        'created_at', 'updated_at'
    ],
    'channel_members': [
        '_id', 'channel_id', 'user_id', 'role', 'joined_at', 'last_read_at'
    ],
    'reactions': [
        '_id', 'message_id', 'user_id', 'emoji', 'created_at'
    ]
}

def compare_schemas():
    """Compare expected vs production schemas"""
    print("=" * 80)
    print("SCHEMA COMPARISON REPORT")
    print("=" * 80)
    
    all_ok = True
    
    for collection, expected in EXPECTED_SCHEMA.items():
        print(f"\n📦 {collection.upper()}")
        print("-" * 80)
        
        if collection not in PRODUCTION_SCHEMA:
            print(f"❌ Collection not found in production!")
            all_ok = False
            continue
        
        prod_fields = set(PRODUCTION_SCHEMA[collection])
        required_fields = set(expected['required'])
        optional_fields = set(expected['optional'])
        all_expected_fields = required_fields | optional_fields
        
        # Check for missing required fields
        missing_required = required_fields - prod_fields
        if missing_required:
            print(f"❌ MISSING REQUIRED FIELDS:")
            for field in missing_required:
                print(f"   - {field}")
            all_ok = False
        else:
            print(f"✅ All required fields present ({len(required_fields)} fields)")
        
        # Check for missing optional fields
        missing_optional = optional_fields - prod_fields
        if missing_optional:
            print(f"⚠️  Missing optional fields (may cause issues):")
            for field in missing_optional:
                print(f"   - {field}")
        
        # Check for extra fields in production
        extra_fields = prod_fields - all_expected_fields
        if extra_fields:
            print(f"ℹ️  Extra fields in production (not in models):")
            for field in extra_fields:
                print(f"   - {field}")
        
        # Summary
        coverage = len(prod_fields & all_expected_fields) / len(all_expected_fields) * 100
        print(f"📊 Coverage: {coverage:.1f}% ({len(prod_fields & all_expected_fields)}/{len(all_expected_fields)} fields)")
    
    print("\n" + "=" * 80)
    if all_ok:
        print("✅ SCHEMA COMPATIBLE - All required fields are present!")
    else:
        print("❌ SCHEMA ISSUES - Some required fields are missing!")
    print("=" * 80)
    
    return all_ok

if __name__ == "__main__":
    compare_schemas()
