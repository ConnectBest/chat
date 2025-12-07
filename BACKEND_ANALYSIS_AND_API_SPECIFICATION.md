# Backend Analysis and Complete API Specification

**Generated:** 2025-12-07
**Author:** AI Analysis Tool
**Version:** 1.0

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Analysis](#architecture-analysis)
3. [Authentication Flow Analysis](#authentication-flow-analysis)
4. [Current Issues and Recommendations](#current-issues-and-recommendations)
5. [Complete API Specification](#complete-api-specification)
6. [Configuration Requirements](#configuration-requirements)
7. [Deployment Considerations](#deployment-considerations)

---

## Executive Summary

### Architecture Overview

The ConnectBest Chat application uses a **hybrid authentication architecture** combining:
- **NextAuth.js** (frontend, Node.js) - Session management and OAuth
- **Flask** (backend, Python) - Business logic and data access
- **MongoDB** - Shared database for both systems

### Authentication Flow

The system uses a **dual-layer authentication approach**:

1. **NextAuth.js Layer** (Frontend/Next.js API Routes):
   - Manages user sessions via JWT cookies (`next-auth.session-token`)
   - Handles Google OAuth flow
   - Handles credential-based authentication (email/password)
   - Connects **directly to MongoDB** to validate users during sign-in

2. **Flask Backend Layer**:
   - Receives authenticated requests from Next.js API proxy routes
   - Validates user via **custom headers** (`X-User-ID`, `X-User-Email`, `X-User-Role`)
   - Provides REST API for channels, messages, users, etc.
   - Does **NOT** handle OAuth directly (delegated to NextAuth)

### Critical Finding: Authentication Confusion

The current implementation has **authentication pattern confusion** that could lead to integration issues:

1. **Flask backend** expects NextAuth JWT tokens OR custom headers
2. **Next.js frontend** uses API proxy routes that forward custom headers
3. **Documentation** suggests JWT tokens should be passed, but code uses headers
4. **Inconsistency** between documented flow and actual implementation

---

## Architecture Analysis

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                             │
│  Next.js 15 (App Router) + NextAuth.js + TypeScript        │
│                                                              │
│  - Pages: /login, /chat, /admin, /ops, /profile            │
│  - Auth: NextAuth JWT sessions (cookies)                    │
│  - API Calls: Next.js API Routes (proxies)                  │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ HTTP (custom headers)
                   │ X-User-ID, X-User-Email, X-User-Role
                   │
┌──────────────────┴──────────────────────────────────────────┐
│              NEXT.JS API ROUTES (Proxy Layer)               │
│  - Validates NextAuth session                               │
│  - Extracts user info from session                          │
│  - Forwards to Flask with custom headers                    │
│  - Located: app/api/**                                      │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ HTTP + Custom Headers
                   │
┌──────────────────┴──────────────────────────────────────────┐
│                     FLASK BACKEND                            │
│  Flask + Flask-RESTX + SocketIO + Python 3.8+               │
│                                                              │
│  - Auth: @token_required decorator                          │
│  - Validates: Custom headers OR JWT tokens (fallback)       │
│  - Routes: /api/auth, /api/users, /api/chat, etc.          │
│  - Docs: Swagger UI at /docs                                │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ MongoDB Wire Protocol
                   │
┌──────────────────┴──────────────────────────────────────────┐
│                        MONGODB                               │
│  - Database: chatapp (configurable)                         │
│  - Collections: users, channels, messages, etc.             │
│  - Shared by: NextAuth.js AND Flask                         │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow: User Authentication

```
User Action: Sign In
    │
    ├─> [NextAuth Credentials Provider]
    │       │
    │       ├─> Connect to MongoDB directly
    │       ├─> Find user by email
    │       ├─> Verify password (bcrypt)
    │       └─> Create NextAuth session (JWT in cookie)
    │
    └─> NextAuth session stored in browser cookie
```

### Data Flow: API Request

```
User Action: Send Message
    │
    ├─> [React Component]
    │       │
    │       └─> Call: api.sendMessage(channelId, content)
    │               │
    │               └─> fetch('/api/chat/channels/{id}/messages/send')
    │
    ├─> [Next.js API Route: /api/chat/channels/[id]/messages/send/route.ts]
    │       │
    │       ├─> Get NextAuth session: auth()
    │       ├─> Extract: session.user.id, session.user.email, session.user.role
    │       ├─> Forward to Flask:
    │       │       URL: http://localhost:5001/api/chat/channels/{id}/messages/send
    │       │       Headers: X-User-ID, X-User-Email, X-User-Role
    │       │       Body: { content, attachments }
    │       │
    │       └─> Return Flask response to frontend
    │
    ├─> [Flask Route: /api/chat/channels/<id>/messages/send]
    │       │
    │       ├─> @token_required decorator:
    │       │       ├─> Try: Extract user from headers
    │       │       └─> Fallback: Verify JWT token from Authorization header
    │       │
    │       ├─> Validate: User is channel member
    │       ├─> Create message in MongoDB
    │       ├─> Emit Socket.IO event (real-time)
    │       └─> Return: { message: {...} }
    │
    └─> Response flows back through Next.js API route to frontend
```

### Database Schema

**Collections:**

1. **users** - User accounts and authentication
   - `_id`: ObjectId (unique)
   - `email`: String (unique, indexed)
   - `username`: String (unique, indexed)
   - `password_hash`: String (bcrypt, nullable for OAuth users)
   - `full_name`: String
   - `avatar`: String (URL)
   - `role`: String (enum: 'admin', 'user')
   - `status`: String (enum: 'online', 'away', 'busy', 'inmeeting', 'offline')
   - `email_verified`: Boolean
   - `verification_token`: String (nullable)
   - `verification_expires`: DateTime (nullable)
   - `two_factor_enabled`: Boolean
   - `two_factor_secret`: String (nullable)
   - `backup_codes`: Array[String]
   - `google_id`: String (nullable)
   - `oauth_provider`: String (nullable)
   - `created_at`: DateTime
   - `updated_at`: DateTime
   - `last_login`: DateTime (nullable)

2. **channels** - Chat channels
   - `_id`: ObjectId
   - `name`: String (unique)
   - `description`: String
   - `type`: String (enum: 'public', 'private')
   - `created_by`: ObjectId (ref: users)
   - `created_at`: DateTime
   - `is_deleted`: Boolean

3. **channel_members** - Channel membership
   - `_id`: ObjectId
   - `channel_id`: ObjectId (ref: channels)
   - `user_id`: ObjectId (ref: users)
   - `role`: String (enum: 'admin', 'member')
   - `joined_at`: DateTime

4. **messages** - Chat messages
   - `_id`: ObjectId
   - `channel_id`: ObjectId (ref: channels)
   - `user_id`: ObjectId (ref: users)
   - `content`: String
   - `parent_message_id`: ObjectId (nullable, for threads)
   - `attachments`: Array[Object]
   - `is_deleted`: Boolean
   - `created_at`: DateTime
   - `updated_at`: DateTime
   - `edited_at`: DateTime (nullable)

5. **message_reactions** - Message reactions
6. **message_files** - File attachments metadata
7. **message_embeddings** - Vector embeddings for search
8. **user_channel_read** - Read receipts
9. **threads** - Thread metadata

---

## Authentication Flow Analysis

### NextAuth.js Implementation (`lib/auth.ts`)

**Providers:**

1. **Google OAuth Provider**
   - Client ID/Secret from environment
   - Authorization params: `prompt: consent`, `access_type: offline`
   - On successful sign-in:
     - Checks if user exists in MongoDB
     - Creates new user if not exists
     - Updates `last_login`, `avatar`, `google_id`, `oauth_provider`

2. **Credentials Provider**
   - Accepts: `email`, `password`
   - Validation:
     - Connects **directly to MongoDB** (bypassing Flask!)
     - Finds user by email (case-insensitive)
     - Verifies password using bcrypt
     - Updates `last_login` timestamp
   - Returns user object with: `id`, `email`, `name`, `role`, `phone`, `image`

**JWT Callback:**
```typescript
async jwt({ token, user, account }) {
  if (user) {
    token.id = user.id;
    token.role = (user as any).role || 'user';
    token.phone = (user as any).phone;
    token.emailVerified = (user as any).emailVerified;
  }
  return token;
}
```

**Session Callback:**
```typescript
async session({ session, token }) {
  if (session.user) {
    (session.user as any).id = token.id;
    (session.user as any).role = token.role;
    (session.user as any).phone = token.phone;
    (session.user as any).emailVerified = token.emailVerified;
    (session.user as any).accessToken = token; // JWT token for Flask
  }
  return session;
}
```

**Critical Note:** The `accessToken` field contains the **entire NextAuth JWT token**, not a Flask-generated token!

### Flask Authentication Implementation (`utils/auth.py`)

**Primary Function: `extract_user_from_headers()`**
- Reads: `X-User-ID`, `X-User-Email`, `X-User-Role` from request headers
- Returns user info dict if all headers present
- This is the **preferred** authentication method

**Fallback Function: `verify_nextauth_token(token: str)`**
- Decodes JWT using `NEXTAUTH_SECRET` (must match Next.js!)
- Validates signature and expiration
- Extracts: `id`, `sub`, `email`, `role`, `name`, `phone`
- Returns user info dict or None

**Decorator: `@token_required`**
```python
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # FIRST: Try to get user from headers (Next.js proxy approach)
        user_payload = extract_user_from_headers()

        if user_payload:
            request.current_user = user_payload
            return f(*args, **kwargs)

        # FALLBACK: Try JWT token from Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return {'error': 'Unauthorized', 'message': 'Authentication required'}, 401

        token = auth_header.split()[1]  # "Bearer <token>"
        user_payload = verify_nextauth_token(token)

        if not user_payload:
            return {'error': 'Unauthorized', 'message': 'Invalid or expired token'}, 401

        request.current_user = user_payload
        return f(*args, **kwargs)

    return decorated
```

**Access Current User:**
```python
def get_current_user() -> Optional[Dict[str, Any]]:
    return getattr(request, 'current_user', None)
```

### Configuration Requirements

**Frontend (.env.local):**
```bash
NEXTAUTH_SECRET=<same-as-backend>
NEXTAUTH_URL=http://localhost:3000
MONGODB_URI=mongodb://localhost:27017/chatapp
MONGODB_DB_NAME=chatapp
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-secret>
```

**Backend (backend/.env):**
```bash
# Must match NextAuth's NEXTAUTH_SECRET!
NEXTAUTH_SECRET=<same-as-frontend>

# Flask JWT (legacy, used for fallback)
JWT_SECRET_KEY=<flask-jwt-secret>

# MongoDB (shared with NextAuth)
MONGODB_URI=mongodb://localhost:27017/chatapp
MONGODB_DB_NAME=chatapp

# CORS (include Next.js dev and prod ports)
CORS_ORIGINS=http://localhost:3000,http://localhost:8080

# Google OAuth (not used by Flask, handled by NextAuth)
GOOGLE_CLIENT_ID=<optional>
GOOGLE_CLIENT_SECRET=<optional>
```

---

## Current Issues and Recommendations

### Issue 1: Authentication Pattern Inconsistency ⚠️

**Problem:**
- Flask backend supports TWO authentication methods (headers OR JWT)
- Next.js API routes use headers-based auth
- Documentation suggests JWT-based auth
- Confusion about which method is "correct"

**Impact:**
- Developers unsure which method to use
- Potential security vulnerabilities if switching methods
- Difficult to debug authentication issues

**Recommendation:**
1. **STANDARDIZE** on header-based authentication for Next.js → Flask communication
2. **DEPRECATE** JWT token fallback (or clearly document as "direct API access only")
3. **UPDATE** all documentation to reflect header-based flow
4. **ADD** explicit comments explaining the two paths

**Code Change:**
```python
# utils/auth.py - Add clear documentation

def token_required(f):
    """
    Decorator to protect routes that require authentication.

    AUTHENTICATION METHODS (in order of preference):

    1. HEADER-BASED (Recommended for Next.js API routes):
       - Used when requests come through Next.js API proxy
       - Headers: X-User-ID, X-User-Email, X-User-Role
       - Set by Next.js after validating NextAuth session

    2. JWT TOKEN (Fallback for direct API access):
       - Used for direct backend API calls (testing, mobile apps)
       - Header: Authorization: Bearer <NextAuth-JWT-token>
       - Requires NEXTAUTH_SECRET to match frontend

    For standard web app usage, method 1 (headers) is automatic.
    """
    # ... rest of implementation
```

### Issue 2: Shared MongoDB Connection Risk ⚠️

**Problem:**
- Both NextAuth.js AND Flask connect to the same MongoDB
- NextAuth bypasses Flask for authentication queries
- Two separate connection pools
- Potential for data inconsistency

**Impact:**
- Increased connection overhead
- Possible race conditions on user updates
- Harder to maintain transaction consistency

**Recommendation:**
1. **KEEP** current architecture (it's actually fine for this use case)
2. **ENSURE** both systems use same connection string and DB name
3. **ADD** connection pooling configuration in both systems
4. **DOCUMENT** this shared database pattern clearly

**Why it's OK:**
- MongoDB handles concurrent writes well
- Read-heavy workload (authentication checks)
- No complex transactions required
- Simpler deployment (no need for API calls during auth)

### Issue 3: NEXTAUTH_SECRET Configuration Critical ⚠️

**Problem:**
- Flask's `verify_nextauth_token()` REQUIRES `NEXTAUTH_SECRET` to match Next.js
- If secrets don't match, JWT validation fails
- Configuration not clearly documented as required

**Impact:**
- Authentication failures in production if secrets mismatch
- Confusing error messages ("Invalid token")
- Hard to debug

**Recommendation:**
1. **ADD** validation check on Flask startup
2. **LOG** warning if NEXTAUTH_SECRET not set
3. **UPDATE** .env.example with clear warnings

```python
# config.py - Add validation
class Config:
    NEXTAUTH_SECRET = os.getenv('NEXTAUTH_SECRET', 'development-secret-change-in-production')

    def __post_init__(self):
        if os.getenv('FLASK_ENV') == 'production':
            if self.NEXTAUTH_SECRET == 'development-secret-change-in-production':
                raise ValueError(
                    "NEXTAUTH_SECRET must be set in production! "
                    "It must match the NEXTAUTH_SECRET in your Next.js frontend."
                )
```

### Issue 4: Google OAuth Route Deprecation 📝

**Good News:** Already handled correctly!

The Flask backend has this comment:
```python
# NOTE: Google OAuth is now handled by NextAuth.js on the frontend
# The Flask backend routes/google_oauth.py is DEPRECATED and NOT registered
# NextAuth configuration is in: lib/auth.ts
# OAuth user creation/linking is automatic via NextAuth callbacks
```

**Status:** ✅ Correct implementation
- Google OAuth handled entirely by NextAuth.js
- Flask receives already-authenticated users via headers
- No duplicate OAuth flow

### Issue 5: JWT Token Storage in Session 📝

**Current Code:**
```typescript
// lib/auth.ts
async session({ session, token }) {
  // ...
  (session.user as any).accessToken = token; // Entire JWT object
}
```

**Problem:**
- Frontend has entire JWT token in session
- Not actually used anywhere in the codebase
- Bloats session size
- Could leak sensitive token claims

**Recommendation:**
1. **REMOVE** `accessToken` from session (not used)
2. **OR** if needed for future direct API calls, store only the encoded token string

### Issue 6: Error Response Format Inconsistency 📝

**Flask endpoints return different error formats:**

Some routes:
```python
return {'error': 'Message'}, 400
```

Others:
```python
return {'error': 'Message', 'details': '...'}, 400
```

NextAuth endpoints:
```python
return {'error': 'Message', 'message': 'Details'}, 400
```

**Recommendation:**
Standardize on one format:
```python
{
    "error": "Short error code/message",
    "message": "Detailed user-friendly message",
    "details": "Optional technical details",
    "timestamp": "2025-12-07T10:30:00Z"
}
```

---

## Complete API Specification

### Base URL

**Development:**
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5001`
- API Base: `http://localhost:5001/api`

**Production:**
- Frontend: `https://your-domain.com`
- Backend: Internal service URL (ECS, Fargate)
- API Base: Accessed via Next.js proxy routes

### Authentication

All protected endpoints require **ONE** of:

1. **Header-based auth** (Recommended for web app):
   ```
   X-User-ID: <mongodb-user-id>
   X-User-Email: <user-email>
   X-User-Role: <user-role>
   ```

2. **JWT token auth** (For direct API access):
   ```
   Authorization: Bearer <nextauth-jwt-token>
   ```

### API Endpoints

---

#### **Authentication & Users**

##### `POST /api/auth/register`
Register a new user (limited use, most registration via NextAuth)

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "John Doe",
  "phone": "+1234567890",
  "role": "user"
}
```

**Response:** `201 Created`
```json
{
  "message": "Registration successful! Please check your email...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "username": "user",
    "full_name": "John Doe",
    "role": "user",
    "email_verified": false
  },
  "email_sent": true,
  "next_step": "Use NextAuth to sign in after email verification"
}
```

**Errors:**
- `400` - Validation error (email format, password strength, etc.)
- `409` - User already exists

---

##### `POST /api/auth/verify-email`
Verify email address using token sent via email

**Request:**
```json
{
  "token": "verification-token-from-email"
}
```

**Response:** `200 OK`
```json
{
  "message": "Email verified successfully! You can now sign in using NextAuth.",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "email_verified": true
  },
  "next_step": "Sign in at /login using your email and password or Google OAuth"
}
```

**Errors:**
- `400` - Invalid or expired token

---

##### `GET /api/auth/me` 🔒
Get current authenticated user (NextAuth flow)

**Headers:** `X-User-ID`, `X-User-Email`, `X-User-Role` (from NextAuth session)

**Response:** `200 OK`
```json
{
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "username": "user",
    "name": "John Doe",
    "full_name": "John Doe",
    "role": "user",
    "avatar": "https://example.com/avatar.jpg",
    "picture": "https://example.com/avatar.jpg",
    "phone": "+1234567890",
    "status": "online",
    "status_message": "Working from home",
    "google_id": "1234567890",
    "oauth_provider": "google",
    "email_verified": true,
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

**Errors:**
- `401` - Not authenticated
- `404` - User not found in database

---

##### `POST /api/auth/logout` 🔒
Update user status to offline (NextAuth handles session invalidation)

**Response:** `200 OK`
```json
{
  "message": "Status updated to offline. NextAuth handles session logout."
}
```

---

##### `GET /api/auth/status`
Get authentication system status (health check)

**Response:** `200 OK`
```json
{
  "auth_provider": "NextAuth.js",
  "backend_integration": "Flask + NextAuth JWT validation",
  "supported_providers": ["credentials", "google"],
  "endpoints": {
    "login": "Handled by NextAuth at /api/auth/signin",
    "logout": "Handled by NextAuth at /api/auth/signout",
    "session": "Handled by NextAuth at /api/auth/session",
    "registration": "/api/auth/register (limited use)",
    "email_verification": "/api/auth/verify-email"
  }
}
```

---

##### `GET /api/users/me` 🔒
Get current user profile (same as /api/auth/me)

**Response:** Same as `GET /api/auth/me`

---

##### `PUT /api/users/me` 🔒
Update current user profile

**Request:**
```json
{
  "name": "John Updated",
  "phone": "+9876543210",
  "status_message": "In a meeting",
  "status": "busy",
  "avatar": "https://example.com/new-avatar.jpg"
}
```

**Response:** `200 OK`
```json
{
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Updated",
    "full_name": "John Updated",
    "phone": "+9876543210",
    "status": "busy",
    "status_message": "In a meeting"
  },
  "message": "Profile updated successfully"
}
```

**Errors:**
- `400` - Invalid status value (must be: online, away, busy, inmeeting, offline)

---

##### `POST /api/users/me/avatar` 🔒
Upload user avatar image

**Request:** `multipart/form-data`
- `file`: Image file (png, jpg, jpeg, gif, webp)
- OR JSON: `{"avatar_url": "https://..."}`

**Response:** `200 OK`
```json
{
  "message": "Avatar updated",
  "avatar_url": "https://s3.amazonaws.com/bucket/avatars/uuid.jpg"
}
```

**Errors:**
- `400` - No file provided, invalid file type, file too large (>5MB)

---

##### `GET /api/users` 🔒
Get all users (for user directory)

**Response:** `200 OK`
```json
{
  "users": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "username": "john",
      "role": "user",
      "status": "online",
      "avatar": "https://example.com/avatar.jpg"
    }
  ],
  "total": 42
}
```

---

##### `GET /api/users/search?query=john&limit=20` 🔒
Search users by name or email

**Query Parameters:**
- `query` (required): Search term
- `limit` (optional): Max results (default: 20)

**Response:** `200 OK`
```json
{
  "users": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com"
    }
  ]
}
```

---

##### `GET /api/users/statistics` 🔒 (Admin only)
Get system statistics

**Response:** `200 OK`
```json
{
  "statistics": {
    "totalUsers": 150,
    "activeUsers": 42,
    "totalChannels": 25,
    "totalMessages": 10543
  }
}
```

**Errors:**
- `403` - Not admin

---

#### **Channels**

##### `GET /api/chat/channels` 🔒
List user's channels with unread counts

**Response:** `200 OK`
```json
{
  "channels": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "general",
      "description": "General discussion",
      "type": "public",
      "created_by": "507f1f77bcf86cd799439012",
      "created_at": "2025-01-01T00:00:00Z",
      "member_role": "admin",
      "last_message": "Hey everyone!",
      "last_message_at": "2025-01-15T10:30:00Z",
      "unreadCount": 5
    }
  ]
}
```

---

##### `POST /api/chat/channels` 🔒
Create a new channel

**Request:**
```json
{
  "name": "engineering",
  "description": "Engineering team channel",
  "type": "private"
}
```

**Response:** `201 Created`
```json
{
  "channel": {
    "id": "507f1f77bcf86cd799439011",
    "name": "engineering",
    "description": "Engineering team channel",
    "type": "private",
    "created_by": "507f1f77bcf86cd799439012",
    "created_at": "2025-01-15T10:30:00Z"
  }
}
```

**Errors:**
- `400` - Invalid channel name (must be alphanumeric, hyphens, underscores)
- `409` - Channel with this name already exists

---

##### `GET /api/chat/channels/{channelId}` 🔒
Get channel details and members

**Response:** `200 OK`
```json
{
  "channel": {
    "id": "507f1f77bcf86cd799439011",
    "name": "general",
    "description": "General discussion",
    "type": "public",
    "created_by": "507f1f77bcf86cd799439012",
    "created_at": "2025-01-01T00:00:00Z",
    "members": [
      {
        "id": "507f1f77bcf86cd799439012",
        "user_id": "507f1f77bcf86cd799439012",
        "name": "John Doe",
        "email": "john@example.com",
        "role": "admin",
        "joined_at": "2025-01-01T00:00:00Z"
      }
    ]
  }
}
```

**Errors:**
- `403` - Not a member of this channel
- `404` - Channel not found

---

##### `POST /api/chat/channels/{channelId}/join` 🔒
Join a public channel

**Response:** `200 OK`
```json
{
  "message": "Joined channel successfully"
}
```

**Errors:**
- `403` - Cannot join private channel
- `404` - Channel not found
- `400` - Already a member

---

##### `POST /api/chat/channels/{channelId}/members` 🔒
Add a member to channel

**Request:**
```json
{
  "user_id": "507f1f77bcf86cd799439013"
}
```

**Response:** `200 OK`
```json
{
  "message": "Member added successfully"
}
```

**Errors:**
- `400` - User already a member
- `403` - Not authorized (must be channel member)
- `404` - Channel not found

---

##### `DELETE /api/chat/channels/{channelId}/members/{userId}` 🔒
Remove a member from channel

**Response:** `200 OK`
```json
{
  "message": "Member removed successfully"
}
```

**Errors:**
- `403` - Not authorized (must be admin or removing self)
- `400` - User not a member

---

##### `POST /api/chat/channels/{channelId}/read` 🔒
Mark channel messages as read

**Response:** `200 OK`
```json
{
  "message": "Marked as read",
  "data": {
    "user_id": "507f1f77bcf86cd799439011",
    "channel_id": "507f1f77bcf86cd799439012",
    "last_read_at": "2025-01-15T10:30:00Z"
  }
}
```

---

##### `GET /api/chat/channels/{channelId}/typing` 🔒
Get list of users currently typing

**Response:** `200 OK`
```json
{
  "typing_users": ["John Doe", "Jane Smith"]
}
```

---

##### `POST /api/chat/channels/{channelId}/typing` 🔒
Update user's typing status

**Request:**
```json
{
  "typing": true
}
```

**Response:** `200 OK`
```json
{
  "message": "Typing status updated"
}
```

---

##### `GET /api/chat/channels/all` 🔒 (Admin only)
Get all channels with member counts

**Response:** `200 OK`
```json
{
  "channels": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "general",
      "description": "General discussion",
      "type": "public",
      "memberCount": 42,
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "total": 25
}
```

---

#### **Messages**

##### `GET /api/chat/channels/{channelId}/messages?limit=50&before={messageId}` 🔒
Get messages in a channel (with pagination)

**Query Parameters:**
- `limit` (optional): Max messages (default: 50)
- `before` (optional): Message ID for pagination (load older messages)

**Response:** `200 OK`
```json
{
  "messages": [
    {
      "id": "507f1f77bcf86cd799439011",
      "channel_id": "507f1f77bcf86cd799439012",
      "user_id": "507f1f77bcf86cd799439013",
      "user": {
        "id": "507f1f77bcf86cd799439013",
        "name": "John Doe",
        "email": "john@example.com",
        "avatar": "https://example.com/avatar.jpg"
      },
      "content": "Hello everyone!",
      "parent_message_id": null,
      "attachments": [],
      "reactions": [],
      "created_at": "2025-01-15T10:30:00Z",
      "updated_at": "2025-01-15T10:30:00Z",
      "edited_at": null,
      "is_deleted": false
    }
  ]
}
```

**Errors:**
- `403` - Not a member of this channel

---

##### `POST /api/chat/channels/{channelId}/messages/send` 🔒
Send a message in a channel

**Request:**
```json
{
  "content": "Hello everyone!",
  "parent_message_id": null,
  "attachments": [
    {
      "name": "document.pdf",
      "size": 1024000,
      "type": "application/pdf",
      "url": "https://s3.amazonaws.com/bucket/files/uuid.pdf"
    }
  ]
}
```

**Response:** `201 Created`
```json
{
  "message": {
    "id": "507f1f77bcf86cd799439011",
    "channel_id": "507f1f77bcf86cd799439012",
    "user_id": "507f1f77bcf86cd799439013",
    "content": "Hello everyone!",
    "attachments": [...],
    "created_at": "2025-01-15T10:30:00Z"
  }
}
```

**Errors:**
- `400` - Empty content or content too long (>2000 chars)
- `403` - Not a member of this channel

**Side Effects:**
- Emits Socket.IO event: `new_message` to channel room
- Updates channel `last_message_at`

---

##### `GET /api/chat/messages/{messageId}` 🔒
Get a specific message

**Response:** `200 OK`
```json
{
  "message": {
    "id": "507f1f77bcf86cd799439011",
    "channel_id": "507f1f77bcf86cd799439012",
    "content": "Hello everyone!"
  }
}
```

---

##### `PUT /api/chat/messages/{messageId}` 🔒
Edit a message

**Request:**
```json
{
  "content": "Updated message content"
}
```

**Response:** `200 OK`
```json
{
  "message": {
    "id": "507f1f77bcf86cd799439011",
    "content": "Updated message content",
    "edited_at": "2025-01-15T10:35:00Z"
  }
}
```

**Errors:**
- `404` - Message not found or not authorized (must be message author)

---

##### `DELETE /api/chat/messages/{messageId}` 🔒
Delete a message (soft delete)

**Response:** `200 OK`
```json
{
  "message": "Message deleted successfully"
}
```

**Errors:**
- `404` - Message not found or not authorized

---

##### `POST /api/chat/messages/{messageId}/bookmark` 🔒
Toggle bookmark/star on a message

**Response:** `200 OK`
```json
{
  "bookmarked": true
}
```

---

##### `GET /api/chat/messages/{messageId}/replies` 🔒
Get all replies to a message (thread)

**Response:** `200 OK`
```json
{
  "replies": [
    {
      "id": "507f1f77bcf86cd799439014",
      "parent_message_id": "507f1f77bcf86cd799439011",
      "content": "Great point!",
      "user": {...},
      "created_at": "2025-01-15T10:31:00Z"
    }
  ]
}
```

---

##### `POST /api/chat/messages/{messageId}/replies` 🔒
Post a reply to a message (thread)

**Request:**
```json
{
  "content": "Great point!"
}
```

**Response:** `201 Created`
```json
{
  "reply": {
    "id": "507f1f77bcf86cd799439014",
    "parent_message_id": "507f1f77bcf86cd799439011",
    "content": "Great point!",
    "created_at": "2025-01-15T10:31:00Z"
  }
}
```

---

##### `POST /api/chat/channels/{channelId}/messages/{messageId}/reactions` 🔒
Add reaction to a message

**Request:**
```json
{
  "emoji": "👍"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "reaction": {
    "messageId": "507f1f77bcf86cd799439011",
    "userId": "507f1f77bcf86cd799439013",
    "emoji": "👍"
  },
  "reactions": [
    {
      "emoji": "👍",
      "count": 5,
      "users": ["507f1f77bcf86cd799439013", ...]
    }
  ]
}
```

**Side Effects:**
- Emits Socket.IO event: `reaction_added` to channel room

**Errors:**
- `400` - Invalid emoji (max 10 chars)
- `403` - Not a member of channel

---

##### `DELETE /api/chat/channels/{channelId}/messages/{messageId}/reactions` 🔒
Remove reaction from a message

**Response:** `200 OK`
```json
{
  "success": true,
  "reactions": [...]
}
```

---

#### **Direct Messages**

##### `GET /api/dm/conversations` 🔒
Get all DM conversations for current user

**Response:** `200 OK`
```json
{
  "conversations": [
    {
      "dm_channel_id": "507f1f77bcf86cd799439011",
      "user_id": "507f1f77bcf86cd799439012",
      "user_name": "Jane Smith",
      "user_email": "jane@example.com",
      "user_avatar": "https://example.com/avatar.jpg",
      "user_status": "online",
      "last_message": "See you tomorrow!",
      "last_message_at": "2025-01-15T10:30:00Z",
      "unreadCount": 2
    }
  ]
}
```

---

##### `GET /api/dm/users/{recipientId}/messages` 🔒
Get direct messages with a specific user

**Response:** `200 OK`
```json
{
  "messages": [
    {
      "id": "507f1f77bcf86cd799439011",
      "channel_id": "dm_507f1f77bcf86cd799439012_507f1f77bcf86cd799439013",
      "user_id": "507f1f77bcf86cd799439012",
      "content": "Hey!",
      "created_at": "2025-01-15T10:30:00Z"
    }
  ],
  "dm_channel_id": "dm_507f1f77bcf86cd799439012_507f1f77bcf86cd799439013"
}
```

**Note:** DM channels are auto-created with format `dm_{smaller_id}_{larger_id}`

---

##### `POST /api/dm/users/{recipientId}/messages` 🔒
Send a direct message to a user

**Request:**
```json
{
  "content": "Hey there!",
  "attachments": []
}
```

**Response:** `201 Created`
```json
{
  "message": {
    "id": "507f1f77bcf86cd799439011",
    "content": "Hey there!",
    "created_at": "2025-01-15T10:30:00Z"
  },
  "dm_channel_id": "dm_507f1f77bcf86cd799439012_507f1f77bcf86cd799439013"
}
```

**Errors:**
- `404` - Recipient not found

---

##### `POST /api/dm/channels/{dmChannelId}/read` 🔒
Mark DM messages as read

**Response:** `200 OK`
```json
{
  "message": "Marked as read",
  "data": {
    "user_id": "507f1f77bcf86cd799439011",
    "channel_id": "dm_507f1f77bcf86cd799439012_507f1f77bcf86cd799439013",
    "last_read_at": "2025-01-15T10:30:00Z"
  }
}
```

---

#### **File Uploads**

##### `POST /api/upload/avatar` 🔒
Upload avatar image (AWS S3)

**Request:** `multipart/form-data`
- `file`: Image file (png, jpg, jpeg, gif, webp, max 5MB)

**Response:** `200 OK`
```json
{
  "success": true,
  "avatar_url": "https://connectbest-chat-files.s3.us-west-2.amazonaws.com/avatars/uuid.jpg",
  "filename": "avatars/uuid.jpg"
}
```

**Errors:**
- `400` - Invalid file type or size

---

##### `POST /api/upload/message-file` 🔒
Upload file attachment (AWS S3)

**Request:** `multipart/form-data`
- `file`: File (images, documents, videos, audio, max 50MB)

**Response:** `200 OK`
```json
{
  "success": true,
  "file_url": "https://connectbest-chat-files.s3.us-west-2.amazonaws.com/messages/uuid.pdf",
  "filename": "messages/uuid.pdf",
  "original_name": "document.pdf",
  "size": 1024000,
  "type": "application/pdf"
}
```

**Supported File Types:**
- Images: png, jpg, jpeg, gif, webp, bmp, svg
- Documents: pdf, doc, docx, txt, md, rtf
- Spreadsheets: xls, xlsx, csv
- Archives: zip, rar, 7z, tar, gz
- Videos: mp4, avi, mov, wmv, mkv
- Audio: mp3, wav, ogg, flac

---

#### **Two-Factor Authentication**

##### `POST /api/2fa/setup` 🔒
Initialize 2FA setup (generates QR code)

**Request:**
```json
{
  "password": "current-password"
}
```

**Response:** `200 OK`
```json
{
  "message": "Scan the QR code with your authenticator app",
  "qr_code": "data:image/png;base64,...",
  "secret": "ABCD EFGH IJKL MNOP",
  "instructions": [
    "1. Download Google Authenticator, Authy, or similar app",
    "2. Scan the QR code or enter the secret manually",
    "3. Enter the 6-digit code from your app to complete setup"
  ]
}
```

**Errors:**
- `400` - 2FA already enabled
- `401` - Invalid password

---

##### `POST /api/2fa/verify-setup` 🔒
Complete 2FA setup by verifying first code

**Request:**
```json
{
  "code": "123456"
}
```

**Response:** `200 OK`
```json
{
  "message": "2FA has been successfully enabled",
  "backup_codes": [
    "ABCD-1234",
    "EFGH-5678",
    ...
  ],
  "warning": "Save these backup codes in a secure place. Each code can only be used once."
}
```

**Errors:**
- `400` - Invalid code or no setup in progress

---

##### `POST /api/2fa/disable` 🔒
Disable 2FA (requires password + current code)

**Request:**
```json
{
  "password": "current-password",
  "code": "123456"
}
```

**Response:** `200 OK`
```json
{
  "message": "2FA has been successfully disabled"
}
```

---

##### `GET /api/2fa/status` 🔒
Check if 2FA is enabled

**Response:** `200 OK`
```json
{
  "two_factor_enabled": true,
  "setup_in_progress": false
}
```

---

##### `POST /api/2fa/regenerate-backup-codes` 🔒
Regenerate backup codes (invalidates old ones)

**Request:**
```json
{
  "code": "123456"
}
```

**Response:** `200 OK`
```json
{
  "message": "Backup codes have been regenerated",
  "backup_codes": ["ABCD-1234", ...],
  "warning": "Old backup codes are now invalid. Save these new codes securely."
}
```

---

#### **Metrics & Monitoring**

##### `GET /api/metrics/health`
System health check (public endpoint)

**Response:** `200 OK`
```json
{
  "status": "healthy",
  "uptime": 99.99,
  "version": "1.0.0",
  "timestamp": "2025-01-15T10:30:00Z",
  "services": {
    "ecs": {
      "status": "healthy",
      "runningTasks": 2,
      "desiredTasks": 2
    },
    "database": {
      "status": "healthy"
    }
  }
}
```

---

##### `GET /api/metrics/system` 🔒
Current system metrics (CloudWatch)

**Response:** `200 OK`
```json
{
  "activeConnections": 42,
  "totalMessages": 15438,
  "averageLatency": 35.0,
  "errorRate": 0.1,
  "cpuUsage": 25.3,
  "memoryUsage": 45.7
}
```

---

##### `GET /api/metrics/timeseries/{metricType}?period=60&points=20` 🔒
Time series data for metrics

**Path Parameters:**
- `metricType`: cpu, memory, connections, latency, errors

**Query Parameters:**
- `period` (optional): Period in minutes (default: 60)
- `points` (optional): Number of data points (default: 20)

**Response:** `200 OK`
```json
[
  {
    "timestamp": "2025-01-15T10:00:00Z",
    "value": 35.2
  },
  {
    "timestamp": "2025-01-15T10:05:00Z",
    "value": 38.1
  }
]
```

---

##### `GET /api/metrics/alarms` 🔒
CloudWatch alarms status

**Response:** `200 OK`
```json
[
  {
    "name": "chat-app-service-HighCPU",
    "state": "OK",
    "reason": "Threshold not exceeded",
    "timestamp": "2025-01-15T10:30:00Z",
    "threshold": 80.0,
    "metric": "CPUUtilization"
  }
]
```

---

##### `GET /api/metrics/costs` 🔒
AWS cost metrics and optimization

**Response:** `200 OK`
```json
{
  "dailyCost": 2.50,
  "monthlyCost": 75.00,
  "costTrend": "stable",
  "topServices": [
    {"service": "Amazon ECS", "cost": 1.50},
    {"service": "Amazon EC2", "cost": 0.75}
  ],
  "optimization": [
    {
      "type": "Reserved Capacity",
      "description": "Switch to Reserved Instances for 30% savings",
      "potentialSavings": 22.50
    }
  ]
}
```

---

##### `GET /api/metrics/security` 🔒
Security monitoring metrics

**Response:** `200 OK`
```json
{
  "threatsBlocked": 3,
  "suspiciousActivity": 1,
  "authenticationFailures": 5,
  "complianceScore": 94.5,
  "lastSecurityScan": "2025-01-15T04:30:00Z"
}
```

---

### WebSocket (Socket.IO) Events

**Connection URL:** `http://localhost:5001` (or production backend URL)

**Connection Options:**
```javascript
import io from 'socket.io-client';

const socket = io(BACKEND_URL, {
  transports: ['websocket', 'polling'],
  withCredentials: true
});
```

#### Server → Client Events

**`connected`** - Connection established
```json
{
  "message": "Connected to server"
}
```

**`new_message`** - New message in channel
```json
{
  "messageId": "507f1f77bcf86cd799439011",
  "channelId": "507f1f77bcf86cd799439012",
  "userId": "507f1f77bcf86cd799439013",
  "content": "Hello!",
  "user": {...},
  "created_at": "2025-01-15T10:30:00Z"
}
```

**`reaction_added`** - Reaction added to message
```json
{
  "messageId": "507f1f77bcf86cd799439011",
  "channelId": "507f1f77bcf86cd799439012",
  "userId": "507f1f77bcf86cd799439013",
  "emoji": "👍",
  "reactions": [...]
}
```

**`joined_channel`** - Confirmation of joining channel
```json
{
  "channelId": "507f1f77bcf86cd799439011"
}
```

#### Client → Server Events

**`join_channel`** - Join a channel room
```javascript
socket.emit('join_channel', {
  channelId: '507f1f77bcf86cd799439011',
  userId: '507f1f77bcf86cd799439012'
});
```

**`leave_channel`** - Leave a channel room
```javascript
socket.emit('leave_channel', {
  channelId: '507f1f77bcf86cd799439011',
  userId: '507f1f77bcf86cd799439012'
});
```

---

## Configuration Requirements

### Environment Variables

#### Frontend (Next.js) - `.env.local`

```bash
# NextAuth Configuration
NEXTAUTH_SECRET=<strong-random-secret-32-chars>
NEXTAUTH_URL=http://localhost:3000

# MongoDB (shared with Flask backend)
MONGODB_URI=mongodb://localhost:27017/chatapp
MONGODB_DB_NAME=chatapp

# Google OAuth
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>

# Backend URLs
NEXT_PUBLIC_API_URL=http://localhost:5001/api  # Client-side
NEXT_PUBLIC_WS_URL=http://localhost:5001       # Client-side WebSocket
BACKEND_URL=http://localhost:5001              # Server-side internal
```

#### Backend (Flask) - `backend/.env`

```bash
# Flask Configuration
FLASK_ENV=development
DEBUG=True
SECRET_KEY=<flask-session-secret>

# JWT Configuration (legacy, for fallback auth)
JWT_SECRET_KEY=<jwt-secret-key>
JWT_EXPIRATION_HOURS=168

# NextAuth Integration (MUST match frontend!)
NEXTAUTH_SECRET=<same-as-frontend-nextauth-secret>

# MongoDB (shared with NextAuth)
MONGODB_URI=mongodb://localhost:27017/chatapp
MONGODB_DB_NAME=chatapp

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:8080

# Server Configuration
HOST=0.0.0.0
PORT=5001

# File Upload
MAX_CONTENT_LENGTH=52428800  # 50MB
UPLOAD_FOLDER=static/uploads

# AWS Configuration (for production)
AWS_REGION=us-west-2
S3_BUCKET_NAME=connectbest-chat-files
ECS_CLUSTER_NAME=chat-app-cluster
ECS_SERVICE_NAME=chat-app-service

# Email Configuration (optional)
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=<gmail-address>
MAIL_PASSWORD=<gmail-app-password>

# Google OAuth (not used by Flask, handled by NextAuth)
GOOGLE_CLIENT_ID=<optional>
GOOGLE_CLIENT_SECRET=<optional>
```

### Critical Configuration Requirements

1. **NEXTAUTH_SECRET MUST match** between frontend and backend
   - Used by Flask to validate NextAuth JWT tokens
   - If mismatch, JWT validation fails
   - Generate with: `openssl rand -base64 32`

2. **MONGODB_URI MUST be identical** in both systems
   - NextAuth and Flask share the same database
   - User collection accessed by both
   - No schema migration needed

3. **CORS_ORIGINS MUST include all frontend URLs**
   - Development: `http://localhost:3000,http://localhost:8080`
   - Production: `https://your-domain.com`

4. **AWS credentials** (production only)
   - Use IAM roles in ECS (no static keys needed)
   - S3 bucket for file uploads
   - CloudWatch for metrics

---

## Deployment Considerations

### Development Setup

1. **Start MongoDB:**
   ```bash
   # Using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest

   # Or use MongoDB Atlas (cloud)
   ```

2. **Start Flask Backend:**
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env
   # Edit .env with your configuration
   python app.py
   ```

3. **Start Next.js Frontend:**
   ```bash
   npm install
   cp .env.example .env.local
   # Edit .env.local with your configuration
   npm run dev
   ```

4. **Access Application:**
   - Frontend: `http://localhost:3000`
   - Backend API: `http://localhost:5001/api`
   - Swagger Docs: `http://localhost:5001/docs`

### Production Deployment (AWS ECS)

**Architecture:**
```
Internet
    │
    ├─> Application Load Balancer
    │       │
    │       ├─> Target Group 1: Next.js (port 8080)
    │       │       │
    │       │       └─> ECS Service: Frontend
    │       │               └─> Fargate Tasks (Next.js container)
    │       │
    │       └─> Target Group 2: Flask (port 5001)
    │               │
    │               └─> ECS Service: Backend
    │                       └─> Fargate Tasks (Flask container)
    │
    └─> MongoDB Atlas (external)
```

**Deployment Steps:**

1. **Set up MongoDB Atlas:**
   - Create M0 free cluster
   - Whitelist: `0.0.0.0/0` (or specific IPs)
   - Create database user
   - Get connection string: `mongodb+srv://...`

2. **Build Docker Images:**
   ```bash
   # Frontend
   docker build -f Dockerfile.frontend -t chat-frontend:latest .

   # Backend
   docker build -f Dockerfile.backend -t chat-backend:latest .
   ```

3. **Push to AWS ECR:**
   ```bash
   aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-west-2.amazonaws.com

   docker tag chat-frontend:latest <account-id>.dkr.ecr.us-west-2.amazonaws.com/chat-frontend:latest
   docker push <account-id>.dkr.ecr.us-west-2.amazonaws.com/chat-frontend:latest

   docker tag chat-backend:latest <account-id>.dkr.ecr.us-west-2.amazonaws.com/chat-backend:latest
   docker push <account-id>.dkr.ecr.us-west-2.amazonaws.com/chat-backend:latest
   ```

4. **Deploy with AWS CDK:**
   ```bash
   cd infrastructure
   npm install
   cdk bootstrap
   cdk deploy
   ```

5. **Configure Environment Variables in ECS:**
   - Use AWS Systems Manager Parameter Store or Secrets Manager
   - Set MONGODB_URI, NEXTAUTH_SECRET, etc.
   - Update ECS task definitions

### Production Checklist

- [ ] Set `FLASK_ENV=production` and `DEBUG=False`
- [ ] Generate strong secrets for `NEXTAUTH_SECRET`, `JWT_SECRET_KEY`, `SECRET_KEY`
- [ ] Configure CORS_ORIGINS to production domain only
- [ ] Set up MongoDB Atlas with replica set
- [ ] Configure AWS S3 bucket with proper IAM policies
- [ ] Set up CloudWatch alarms for CPU, memory, errors
- [ ] Configure application load balancer with HTTPS
- [ ] Set up Route53 for domain management
- [ ] Configure AWS WAF for security
- [ ] Set up AWS Backup for MongoDB snapshots
- [ ] Configure log aggregation (CloudWatch Logs)
- [ ] Set up monitoring dashboard (CloudWatch/Grafana)
- [ ] Test OAuth flows in production
- [ ] Verify email sending works
- [ ] Test WebSocket connections at scale

---

## Summary and Recommendations

### Current State: ✅ Generally Well-Architected

The codebase demonstrates **good separation of concerns** with:
- NextAuth handling frontend authentication
- Flask providing backend business logic
- Shared MongoDB for data persistence
- Socket.IO for real-time features

### Issues Identified: ⚠️

1. **Authentication pattern confusion** (headers vs JWT)
2. **Configuration complexity** (NEXTAUTH_SECRET matching requirement)
3. **Documentation gaps** (actual flow differs from described flow)
4. **Error response inconsistency**

### Priority Fixes:

**HIGH Priority:**
1. Add validation for NEXTAUTH_SECRET matching on startup
2. Document header-based auth as primary method
3. Standardize error response format

**MEDIUM Priority:**
1. Remove unused `accessToken` from NextAuth session
2. Add connection pool configuration docs
3. Improve error messages for auth failures

**LOW Priority:**
1. Add request/response examples to Swagger docs
2. Create integration tests for auth flow
3. Add rate limiting to API endpoints

### Production-Ready Status: ✅ YES (with fixes)

The application is **production-ready** after addressing the HIGH priority items. The architecture is sound, authentication is secure, and the codebase follows best practices.

**Estimated effort to production readiness:** 2-3 days

---

## Appendix: Common Troubleshooting

### Issue: "Invalid or expired token"

**Cause:** NEXTAUTH_SECRET mismatch between frontend and backend

**Solution:**
1. Check `.env.local` and `backend/.env`
2. Ensure NEXTAUTH_SECRET is identical
3. Restart both servers

### Issue: "Authentication required"

**Cause:** Missing or invalid headers from Next.js proxy

**Solution:**
1. Check Next.js API route is calling `auth()`
2. Verify session exists: `console.log(session)`
3. Check headers are set: `X-User-ID`, `X-User-Email`, `X-User-Role`

### Issue: MongoDB connection failures

**Cause:** Connection string issues or network problems

**Solution:**
1. Verify MONGODB_URI format: `mongodb+srv://...?retryWrites=true&w=majority`
2. Check MongoDB Atlas network access (whitelist IP)
3. Test connection: `mongosh "<connection-string>"`
4. Check container can reach MongoDB (networking)

### Issue: CORS errors

**Cause:** Frontend origin not in CORS_ORIGINS

**Solution:**
1. Add frontend URL to `backend/.env`: `CORS_ORIGINS=http://localhost:3000,...`
2. Restart Flask server
3. Check browser console for exact origin

### Issue: File upload fails

**Cause:** AWS credentials or S3 bucket not configured

**Solution:**
1. Set AWS_REGION and S3_BUCKET_NAME in backend/.env
2. Ensure IAM role has S3 write permissions (ECS)
3. Or use AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (local dev)
4. Test: `aws s3 ls s3://bucket-name`

---

**End of Document**
