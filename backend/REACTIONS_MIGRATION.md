# Reactions Collection Migration Guide

## Overview

This document describes the migration from `message_reactions` to `reactions` collection name to unify the naming convention across the codebase.

## Background

The codebase previously used two different collection names for message reactions:
- **`reactions`** - Used by `backend/models/reaction.py` and `backend/setup_enhanced_schema.py`
- **`message_reactions`** - Used by `backend/init_db.py`, `backend/models/message.py`, `backend/scripts/compare_schema.py`, and documentation

This inconsistency could lead to:
- Runtime errors when code references the wrong collection
- Missing indexes on the actual collection in use
- Data split across two collections
- Confusion for developers

## Solution

We've standardized on **`reactions`** as the canonical collection name because:
1. It's more concise and follows MongoDB naming conventions
2. The `Reaction` model already defines `COLLECTION = 'reactions'`
3. The enhanced schema setup script uses `'reactions'`
4. It's consistent with other collection names (`files`, `threads`, `messages`, etc.)

## Changes Made

### Backend Code
- `backend/models/message.py`: Updated `REACTIONS_COLLECTION = 'reactions'`
- `backend/init_db.py`: Changed collection initialization to use `'reactions'`
- `backend/scripts/compare_schema.py`: Updated schema definitions to reference `'reactions'`

### Documentation
- `CLAUDE.md`: Updated database schema description
- `docs/architecture/DATABASE_AI_REQUIREMENTS.md`: Updated table name to `reactions`

### Migration Tools
- `backend/scripts/migrate_reactions_collection.py`: Automated migration script

## Migration Process

### For Development Environments

If you're running a development database, you have two options:

#### Option 1: Fresh Start (Recommended for Dev)
```bash
# Drop the old collection if it exists
# This is only safe if you don't have important data!
cd backend
python3 << EOF
from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()
client = MongoClient(os.getenv('MONGO_URI', 'mongodb://localhost:27017/'))
db = client[os.getenv('DATABASE_NAME', 'chatapp')]

if 'message_reactions' in db.list_collection_names():
    db['message_reactions'].drop()
    print("Dropped message_reactions collection")

# Re-run init_db.py to create the correct collection
EOF

python3 init_db.py
```

#### Option 2: Migrate Existing Data
```bash
cd backend
python3 scripts/migrate_reactions_collection.py
```

### For Production/Staging Environments

**IMPORTANT**: Always run the migration script, never drop the collection!

```bash
cd backend

# 1. Backup your database first
mongodump --uri="your-mongodb-uri" --out=backup-$(date +%Y%m%d)

# 2. Run the migration script
python3 scripts/migrate_reactions_collection.py

# 3. Verify the migration
python3 test_reactions_collection_name.py
python3 scripts/compare_schema.py
```

## Migration Script Behavior

The migration script (`migrate_reactions_collection.py`) handles all scenarios automatically:

### Scenario 1: Only `message_reactions` exists
- Renames `message_reactions` to `reactions`
- Creates proper indexes
- Zero downtime

### Scenario 2: Both collections exist
- Merges data from `message_reactions` into `reactions`
- Removes duplicates (based on unique constraint: message_id + user_id)
- Drops `message_reactions` after successful merge
- Creates proper indexes

### Scenario 3: Only `reactions` exists
- Nothing to do - already correct
- Ensures indexes exist

### Scenario 4: Neither exists
- Creates `reactions` collection with proper indexes

## Verification

After migration, verify everything is correct:

```bash
cd backend

# 1. Run the consistency test
python3 test_reactions_collection_name.py

# 2. Check schema compatibility
python3 scripts/compare_schema.py

# 3. Verify collection exists with correct indexes
python3 << EOF
from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()
client = MongoClient(os.getenv('MONGO_URI'))
db = client[os.getenv('DATABASE_NAME')]

print("Collections:", db.list_collection_names())
print("\nIndexes on 'reactions':")
for idx in db['reactions'].list_indexes():
    print(f"  - {idx['name']}: {idx.get('key', {})}")
EOF
```

## Rollback Plan

If you need to rollback (should not be necessary):

```python
# Rename reactions back to message_reactions
from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()
client = MongoClient(os.getenv('MONGO_URI'))
db = client[os.getenv('DATABASE_NAME')]

db['reactions'].rename('message_reactions')
```

**Note**: After rollback, you'll also need to revert the code changes.

## Impact on Running Applications

### During Migration
- Zero downtime - the migration script is non-blocking
- Existing reactions continue to work
- New reactions will be added to the correct collection

### After Migration
- No API changes - all endpoints remain the same
- Existing data is preserved
- Performance may improve slightly due to proper indexing

## Testing

Test the changes in your environment:

```bash
cd backend

# 1. Test collection name consistency
python3 test_reactions_collection_name.py

# 2. Test reactions functionality (if you have app tests)
pytest tests/test_reactions.py  # if it exists

# 3. Manual testing
# - Add a reaction to a message
# - Remove a reaction
# - View reactions on a message
# - Check that reactions are persisted correctly
```

## FAQ

### Q: Will this break my existing reactions?
**A**: No, the migration script preserves all existing data.

### Q: Do I need to update my frontend code?
**A**: No, the API endpoints haven't changed. This is purely a backend change.

### Q: What if the migration fails?
**A**: The migration script has error handling and will not drop data unless the merge is successful. If it fails, your original data remains intact.

### Q: Can I run the migration multiple times?
**A**: Yes, the migration script is idempotent - it's safe to run multiple times.

### Q: What if I'm starting a fresh database?
**A**: Just run `init_db.py` and it will create the correct `reactions` collection.

## Support

If you encounter any issues during migration:
1. Check the migration script output for error messages
2. Verify your MongoDB connection is working
3. Ensure you have proper permissions on the database
4. Check the database logs for any errors

## Timeline

- **Development**: Migrate immediately
- **Staging**: Before next deployment
- **Production**: During next maintenance window or low-traffic period

## Related Files

- `backend/models/reaction.py` - Reaction model definition
- `backend/models/message.py` - Message model with reaction methods
- `backend/routes/messages.py` - API endpoints for reactions
- `backend/init_db.py` - Database initialization
- `backend/scripts/migrate_reactions_collection.py` - Migration script
- `backend/test_reactions_collection_name.py` - Validation tests
