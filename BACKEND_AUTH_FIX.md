# Backend Authentication Fix

## Problem

After migrating from a dual OAuth implementation to a microservice architecture on ECS Fargate where the frontend handles OAuth directly, backend requests were failing with authentication errors. The issue was a mismatch between:

1. **Frontend (Next.js)**: Properly sends user-identifying headers (`X-User-ID`, `X-User-Email`, `X-User-Role`) to Flask backend via API routes
2. **Backend Decorator**: Updated `@token_required` decorator that extracts user from headers and sets `request.current_user`
3. **Backend Routes**: Still expected `current_user` as a function parameter (OLD PATTERN)

## Root Cause

The `@token_required` decorator in `backend/utils/auth.py` was updated to work with the new authentication flow:

```python
@token_required
def decorated(*args, **kwargs):
    # Extract user from headers
    user_payload = extract_user_from_headers()
    if user_payload:
        request.current_user = user_payload
        return f(*args, **kwargs)  # Does NOT pass current_user as kwarg!
```

However, all route methods still had the old signature:

```python
@token_required
def get(self, current_user):  # ❌ current_user parameter never gets a value
    channel_model.find_by_user(current_user['user_id'])  # ❌ Would fail
```

This caused TypeErrors: `get() missing 1 required positional argument: 'current_user'`

## Solution

Updated all Flask-RESTX Resource methods and Blueprint route functions to:
1. Remove `current_user` from function parameters
2. Call `get_current_user()` at the start of the function to get user info

### Before
```python
from utils.auth import token_required

@channels_ns.route('')
class ChannelList(Resource):
    @token_required
    def get(self, current_user):
        """List user's channels"""
        try:
            channels = channel_model.find_by_user(current_user['user_id'])
```

### After
```python
from utils.auth import token_required, get_current_user

@channels_ns.route('')
class ChannelList(Resource):
    @token_required
    def get(self):
        """List user's channels"""
        current_user = get_current_user()
        try:
            channels = channel_model.find_by_user(current_user['user_id'])
```

## Files Modified

All backend route files were updated to use the new pattern:

- ✅ `backend/routes/channels.py` (11 methods)
- ✅ `backend/routes/users.py` (6 methods)
- ✅ `backend/routes/direct_messages.py` (4 methods)
- ✅ `backend/routes/messages.py` (10 methods)
- ✅ `backend/routes/metrics.py` (5 methods)
- ✅ `backend/routes/two_factor.py` (5 methods)
- ✅ `backend/routes/upload.py` (3 methods)
- ✅ `backend/routes/upload_cloudinary.py` (2 methods)
- ✅ `backend/routes/upload_s3.py` (3 methods)
- ✅ `backend/routes/google_oauth.py` (1 method)

## Authentication Flow (After Fix)

### 1. Frontend Login (Next.js)
- User logs in via NextAuth (credentials or Google OAuth)
- NextAuth creates session in HTTP-only cookie (`authjs.session-token`)
- Session contains user info: id, email, role

### 2. Frontend API Call
- Frontend calls Next.js API route (e.g., `/api/chat/channels`)
- API route extracts NextAuth session server-side
- API route sends user headers to Flask backend:
  ```typescript
  headers: {
    'X-User-ID': session.user.id,
    'X-User-Email': session.user.email,
    'X-User-Role': session.user.role || 'user'
  }
  ```

### 3. Backend Authentication
- Flask receives request with user headers
- `@token_required` decorator extracts user from headers:
  ```python
  user_payload = extract_user_from_headers()  # Gets X-User-ID, X-User-Email, X-User-Role
  request.current_user = user_payload
  ```
- Route method calls `get_current_user()` to access user info:
  ```python
  current_user = get_current_user()
  # current_user = {'user_id': '...', 'email': '...', 'role': 'user'}
  ```

### 4. Fallback: Direct API Access (Optional)
If user headers are missing, decorator falls back to JWT token validation:
```python
auth_header = request.headers.get('Authorization')  # Bearer <token>
user_payload = verify_nextauth_token(token)
request.current_user = user_payload
```

## Testing

To verify the fix:

1. **Frontend sends correct headers**: Already working ✅
   - Next.js API routes send X-User-ID, X-User-Email, X-User-Role

2. **Backend extracts user correctly**: Already working ✅
   - `extract_user_from_headers()` in `backend/utils/auth.py`

3. **Routes use get_current_user()**: Fixed ✅
   - All route methods now call `get_current_user()`

## Backwards Compatibility

The fix maintains backwards compatibility:
- Routes that weren't using `current_user` parameter: No change needed
- Public routes without `@token_required`: No change needed
- Admin routes with `@admin_required`: Same pattern applies

## Documentation References

- `backend/utils/auth.py` - Lines 117-120: Documentation for `@token_required` decorator
- `AUTHENTICATION_MIGRATION.md` - Frontend authentication migration details
- `CLAUDE.md` - Repository architecture overview

## Next Steps

1. ✅ All backend routes updated
2. ⏳ Deploy to staging environment
3. ⏳ Test end-to-end authentication flow
4. ⏳ Verify all protected endpoints work correctly
5. ⏳ Monitor for any authentication errors in logs
