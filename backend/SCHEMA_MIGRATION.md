# MongoDB Schema Migration & Adapter Guide

## Problem
Your production team has a different MongoDB schema structure than the one in your development environment. This document provides strategies to handle this.

---

## Solution Options

### **Option 1: Schema Adapter Layer (Recommended)**
Create an adapter layer that translates between your backend code and the production schema.

**Pros:**
- No need to change your backend code
- Works with any schema structure
- Easy to maintain different environments
- Can support multiple schema versions

**Implementation:**
1. Create `adapters/` folder with schema mapping logic
2. Configure schema type via environment variable
3. Adapters convert data between formats

### **Option 2: Schema Migration Script**
Run a one-time migration to convert production data to match your schema.

**Pros:**
- Clean, consistent schema across all environments
- No runtime overhead
- Simpler backend code

**Cons:**
- Requires database migration
- Risk of data loss if not careful
- May need downtime

### **Option 3: Flexible Models**
Make your models flexible to handle multiple schema structures.

**Pros:**
- Works immediately with any schema
- No migration needed

**Cons:**
- More complex model code
- Harder to maintain

---

## Recommended Approach: Schema Adapter Pattern

### Step 1: Document Production Schema
First, get the production schema structure from your team:

```javascript
// Example: Production schema might look like:
{
  // Users collection
  users: {
    _id: ObjectId,
    emailAddress: String,  // Your code uses 'email'
    displayName: String,    // Your code uses 'full_name'
    userRole: String,       // Your code uses 'role'
    // ... other fields
  },
  
  // Channels collection
  channels: {
    _id: ObjectId,
    channelName: String,   // Your code uses 'name'
    channelType: String,   // Your code uses 'type'
    // ... other fields
  }
}
```

### Step 2: Create Adapter Class

Create `/backend/adapters/schema_adapter.py`:

```python
"""
Schema Adapter
Translates between different MongoDB schema formats
"""
from typing import Dict, Any, Optional
import os

class SchemaAdapter:
    """
    Adapts data between your backend models and production schema
    """
    
    def __init__(self, schema_type: str = None):
        """
        Initialize adapter with schema type
        
        Args:
            schema_type: 'development' or 'production'
        """
        self.schema_type = schema_type or os.getenv('SCHEMA_TYPE', 'development')
    
    # ========== USER ADAPTERS ==========
    
    def adapt_user_to_model(self, prod_user: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert production user document to your model format
        
        Args:
            prod_user: User document from production database
        
        Returns:
            User document in your model format
        """
        if self.schema_type == 'development':
            return prod_user  # No adaptation needed
        
        # Production -> Your Model mapping
        return {
            '_id': prod_user.get('_id'),
            'email': prod_user.get('emailAddress'),  # Map emailAddress -> email
            'full_name': prod_user.get('displayName'),  # Map displayName -> full_name
            'username': prod_user.get('userName') or prod_user.get('emailAddress', '').split('@')[0],
            'password_hash': prod_user.get('passwordHash'),
            'role': prod_user.get('userRole', 'user').lower(),
            'status': prod_user.get('onlineStatus', 'offline'),
            'avatar': prod_user.get('profilePicture'),
            'email_verified': prod_user.get('isEmailVerified', False),
            'created_at': prod_user.get('createdDate') or prod_user.get('created_at'),
            'updated_at': prod_user.get('lastModified') or prod_user.get('updated_at'),
            # Add other field mappings as needed
        }
    
    def adapt_user_to_production(self, model_user: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert your model user to production format (for writes)
        
        Args:
            model_user: User document in your model format
        
        Returns:
            User document in production format
        """
        if self.schema_type == 'development':
            return model_user
        
        # Your Model -> Production mapping
        return {
            'emailAddress': model_user.get('email'),
            'displayName': model_user.get('full_name'),
            'userName': model_user.get('username'),
            'passwordHash': model_user.get('password_hash'),
            'userRole': model_user.get('role', 'user').upper(),
            'onlineStatus': model_user.get('status', 'offline'),
            'profilePicture': model_user.get('avatar'),
            'isEmailVerified': model_user.get('email_verified', False),
            'createdDate': model_user.get('created_at'),
            'lastModified': model_user.get('updated_at'),
        }
    
    # ========== CHANNEL ADAPTERS ==========
    
    def adapt_channel_to_model(self, prod_channel: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert production channel to your model format
        """
        if self.schema_type == 'development':
            return prod_channel
        
        return {
            '_id': prod_channel.get('_id'),
            'name': prod_channel.get('channelName'),
            'description': prod_channel.get('channelDescription'),
            'type': prod_channel.get('channelType', 'public').lower(),
            'created_by': prod_channel.get('createdBy'),
            'created_at': prod_channel.get('createdDate'),
            'updated_at': prod_channel.get('lastModified'),
            'is_deleted': prod_channel.get('isDeleted', False),
        }
    
    def adapt_channel_to_production(self, model_channel: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert your model channel to production format
        """
        if self.schema_type == 'development':
            return model_channel
        
        return {
            'channelName': model_channel.get('name'),
            'channelDescription': model_channel.get('description'),
            'channelType': model_channel.get('type', 'public').upper(),
            'createdBy': model_channel.get('created_by'),
            'createdDate': model_channel.get('created_at'),
            'lastModified': model_channel.get('updated_at'),
            'isDeleted': model_channel.get('is_deleted', False),
        }
    
    # ========== MESSAGE ADAPTERS ==========
    
    def adapt_message_to_model(self, prod_message: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert production message to your model format
        """
        if self.schema_type == 'development':
            return prod_message
        
        return {
            '_id': prod_message.get('_id'),
            'channel_id': prod_message.get('channelId'),
            'user_id': prod_message.get('userId') or prod_message.get('senderId'),
            'content': prod_message.get('messageText') or prod_message.get('content'),
            'parent_message_id': prod_message.get('replyToMessageId'),
            'is_pinned': prod_message.get('isPinned', False),
            'is_edited': prod_message.get('isEdited', False),
            'is_deleted': prod_message.get('isDeleted', False),
            'created_at': prod_message.get('sentAt') or prod_message.get('created_at'),
            'updated_at': prod_message.get('modifiedAt') or prod_message.get('updated_at'),
            'edited_at': prod_message.get('editedAt'),
        }
    
    def adapt_message_to_production(self, model_message: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert your model message to production format
        """
        if self.schema_type == 'development':
            return model_message
        
        return {
            'channelId': model_message.get('channel_id'),
            'senderId': model_message.get('user_id'),
            'messageText': model_message.get('content'),
            'replyToMessageId': model_message.get('parent_message_id'),
            'isPinned': model_message.get('is_pinned', False),
            'isEdited': model_message.get('is_edited', False),
            'isDeleted': model_message.get('is_deleted', False),
            'sentAt': model_message.get('created_at'),
            'modifiedAt': model_message.get('updated_at'),
            'editedAt': model_message.get('edited_at'),
        }


# Singleton instance
_adapter = None

def get_adapter() -> SchemaAdapter:
    """Get the global schema adapter instance"""
    global _adapter
    if _adapter is None:
        _adapter = SchemaAdapter()
    return _adapter
```

### Step 3: Update Your Models to Use Adapters

Modify `/backend/models/user.py`:

```python
from adapters.schema_adapter import get_adapter

class User:
    def __init__(self, db):
        self.collection = db['users']
        self.adapter = get_adapter()
    
    def find_by_email(self, email: str):
        # Query production database
        prod_user = self.collection.find_one({'emailAddress': email})  # Production field name
        
        # Adapt to your model format
        if prod_user:
            return self.adapter.adapt_user_to_model(prod_user)
        return None
```

### Step 4: Configure via Environment Variable

Add to `/backend/.env`:

```bash
# Schema Configuration
SCHEMA_TYPE=production  # or 'development'
```

---

## Quick Implementation Checklist

1. **Get Production Schema Documentation**
   ```bash
   # Ask your team for:
   - Collection names
   - Field names for users, channels, messages
   - Data types
   - Any nested structures
   ```

2. **Create Adapter File**
   - Copy the schema_adapter.py template above
   - Modify field mappings to match production schema

3. **Update Environment Config**
   - Add `SCHEMA_TYPE=production` to .env
   - Keep development .env with `SCHEMA_TYPE=development`

4. **Test with Both Schemas**
   - Test locally with dev schema
   - Test on staging with production schema
   - Verify data flows correctly

5. **Deploy**
   - Deploy with production .env configuration
   - Monitor logs for any mapping errors

---

## Alternative: Ask Team to Provide Schema Mapping

If production schema is complex, ask your team to provide:

```json
{
  "user_mapping": {
    "email": "emailAddress",
    "full_name": "displayName",
    "username": "userName"
  },
  "channel_mapping": {
    "name": "channelName",
    "type": "channelType"
  }
}
```

Then load this JSON file in your adapter for automatic mapping.

---

## Need Help?

If you provide me with the production schema structure, I can:
1. Create the exact adapter mappings
2. Update your models to use the adapters
3. Test the integration

**Next Step:** Get the production schema from your team and we'll create the exact adapter you need.
