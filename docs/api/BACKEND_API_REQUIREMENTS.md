# Backend API Requirements - ConnectBest Chat Application

## 📋 Overview
This document provides comprehensive API specifications that the backend team needs to implement for the ConnectBest Chat application. All endpoints currently use mock implementations marked with `// Static code Backend team please change it to dynamic`.

---

## 🔐 1. Authentication & Authorization APIs

### 1.1 User Registration
**Endpoint:** `POST /api/auth/register`

**Request Body:**
```json
{
  "email": "string (required, valid email)",
  "password": "string (required, min 8 chars, must include uppercase, lowercase, number)",
  "name": "string (required, min 2 chars)",
  "phone": "string (optional, E.164 format)"
}
```

**Response (201 Created):**
```json
{
  "user": {
    "id": "string (UUID)",
    "email": "string",
    "name": "string",
    "role": "user",
    "phone": "string | null",
    "emailVerified": false,
    "createdAt": "ISO 8601 timestamp"
  },
  "token": "string (JWT)",
  "message": "Verification email sent to {email}"
}
```

**Requirements:**
- Hash passwords using bcrypt (salt rounds: 10+)
- Generate UUID for user ID
- Send email verification with 6-digit code
- Verification code valid for 10 minutes
- Default role: "user"
- Store user in database
- Return JWT token with 7-day expiry

**Error Responses:**
- 400: Invalid input, email already exists
- 500: Server error

---

### 1.2 User Login
**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "string (required)",
  "password": "string (required)",
  "verificationCode": "string (optional, 6 digits for 2FA)"
}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "string",
    "email": "string",
    "name": "string",
    "role": "admin | user",
    "phone": "string | null",
    "image": "string | null",
    "emailVerified": "boolean",
    "status": "online | away | busy | inmeeting | offline",
    "statusMessage": "string | null"
  },
  "token": "string (JWT)"
}
```

**Requirements:**
- Verify password with bcrypt
- Check if 2FA is enabled for user
- If 2FA enabled and no code provided, return 402 (payment required for 2FA)
- If 2FA enabled, verify 6-digit code
- Generate JWT with user ID, email, role
- JWT expiry: 7 days
- Update last login timestamp
- Set user status to "online"

**Error Responses:**
- 400: Invalid credentials
- 401: Email not verified
- 402: 2FA verification required
- 403: Account suspended
- 500: Server error

---

### 1.3 Email Verification
**Endpoint:** `POST /api/auth/verify-email`

**Request Body:**
```json
{
  "email": "string (required)",
  "code": "string (required, 6 digits)"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

**Requirements:**
- Verify 6-digit code matches and not expired
- Mark user email as verified
- Delete verification code from database

---

### 1.4 Resend Verification Code
**Endpoint:** `POST /api/auth/resend-verification`

**Request Body:**
```json
{
  "email": "string (required)"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Verification code sent"
}
```

**Requirements:**
- Generate new 6-digit code
- Send email with new code
- Update expiry to 10 minutes from now

---

### 1.5 Get Current User
**Endpoint:** `GET /api/auth/me`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "string",
    "email": "string",
    "name": "string",
    "role": "admin | user",
    "phone": "string | null",
    "image": "string | null",
    "status": "online | away | busy | inmeeting | offline",
    "statusMessage": "string | null",
    "emailVerified": "boolean",
    "preferences": {
      "notifications": "boolean",
      "soundEnabled": "boolean",
      "timezone": "string"
    },
    "createdAt": "ISO 8601 timestamp"
  }
}
```

**Requirements:**
- Verify JWT token
- Return user data from database
- Return 401 if token invalid/expired

---

### 1.6 Logout
**Endpoint:** `POST /api/auth/logout`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

**Requirements:**
- Invalidate JWT token (add to blacklist)
- Set user status to "offline"
- Clear any active sessions

---

### 1.7 Password Reset Request
**Endpoint:** `POST /api/auth/forgot-password`

**Request Body:**
```json
{
  "email": "string (required)"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password reset link sent to email"
}
```

**Requirements:**
- Generate secure reset token (UUID)
- Store token with 1-hour expiry
- Send email with reset link
- Link format: `https://app.com/reset-password?token={token}`

---

### 1.8 Password Reset
**Endpoint:** `POST /api/auth/reset-password`

**Request Body:**
```json
{
  "token": "string (required)",
  "newPassword": "string (required, min 8 chars)"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password updated successfully"
}
```

**Requirements:**
- Verify reset token is valid and not expired
- Hash new password with bcrypt
- Update user password
- Delete reset token
- Invalidate all existing JWT tokens for user

---

### 1.9 Google OAuth Callback
**Endpoint:** `GET /api/auth/callback/google`

**Query Parameters:**
```
code: string (authorization code from Google)
state: string (CSRF protection)
```

**Requirements:**
- Exchange code for Google access token
- Fetch user profile from Google
- Check if user exists by email
- If new user, create account with role "user"
- If existing user, update Google profile data
- Generate JWT token
- Redirect to dashboard with token

---

### 1.10 Enable 2FA
**Endpoint:** `POST /api/auth/2fa/enable`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Request Body:**
```json
{
  "phone": "string (required, E.164 format)"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "2FA enabled. Verification code sent to phone"
}
```

**Requirements:**
- Verify user is authenticated
- Store phone number
- Generate 6-digit code
- Send SMS verification code
- Mark 2FA as enabled

---

## 👤 2. User Management APIs

### 2.1 Update User Profile
**Endpoint:** `PUT /api/users/profile`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Request Body (all optional):**
```json
{
  "name": "string",
  "phone": "string",
  "statusMessage": "string",
  "preferences": {
    "notifications": "boolean",
    "soundEnabled": "boolean",
    "timezone": "string"
  }
}
```

**Response (200 OK):**
```json
{
  "user": { /* updated user object */ }
}
```

---

### 2.2 Upload Avatar
**Endpoint:** `POST /api/users/avatar`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: multipart/form-data
```

**Request Body:**
```
file: File (required, max 5MB, jpg/png/gif)
```

**Response (200 OK):**
```json
{
  "avatarUrl": "string (CDN URL)"
}
```

**Requirements:**
- Validate file type and size
- Upload to cloud storage (S3/CloudFlare/GCS)
- Generate CDN URL
- Update user avatar URL in database
- Delete old avatar if exists

---

### 2.3 Update User Status
**Endpoint:** `PUT /api/users/status`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Request Body:**
```json
{
  "status": "online | away | busy | inmeeting | offline",
  "statusMessage": "string (optional, max 100 chars)"
}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

**Requirements:**
- Update user status in database
- Broadcast status change via WebSocket to all connected users
- Update user's presence in Redis cache

---

### 2.4 Search Users
**Endpoint:** `GET /api/users/search`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Query Parameters:**
```
query: string (required, min 2 chars)
limit: number (optional, default 20, max 50)
```

**Response (200 OK):**
```json
{
  "users": [
    {
      "id": "string",
      "name": "string",
      "email": "string",
      "phone": "string | null",
      "status": "online | away | busy | inmeeting | offline",
      "avatar": "string | null"
    }
  ]
}
```

**Requirements:**
- Search by name, email, or phone
- Case-insensitive search
- Exclude suspended users
- Return users sorted by relevance

---

### 2.5 Get User by ID
**Endpoint:** `GET /api/users/:userId`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "string",
    "name": "string",
    "email": "string",
    "phone": "string | null",
    "status": "online | away | busy | inmeeting | offline",
    "statusMessage": "string | null",
    "avatar": "string | null",
    "createdAt": "ISO 8601 timestamp"
  }
}
```

---

## 💬 3. Channel Management APIs

### 3.1 List Channels
**Endpoint:** `GET /api/chat/channels`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Query Parameters:**
```
type: "public" | "private" | "all" (optional, default "all")
limit: number (optional, default 50)
offset: number (optional, default 0)
```

**Response (200 OK):**
```json
{
  "channels": [
    {
      "id": "string (UUID)",
      "name": "string",
      "description": "string | null",
      "type": "public | private",
      "createdBy": "string (user ID)",
      "memberCount": "number",
      "unreadCount": "number",
      "lastMessage": {
        "content": "string",
        "createdAt": "ISO 8601 timestamp",
        "user": {
          "id": "string",
          "name": "string"
        }
      } | null,
      "createdAt": "ISO 8601 timestamp"
    }
  ],
  "total": "number"
}
```

**Requirements:**
- Return only channels user is a member of
- Include unread message count for each channel
- Sort by last activity (most recent first)
- Support pagination

---

### 3.2 Create Channel
**Endpoint:** `POST /api/chat/channels`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Request Body:**
```json
{
  "name": "string (required, unique, lowercase, alphanumeric + hyphens)",
  "description": "string (optional, max 500 chars)",
  "type": "public | private",
  "members": ["string (user IDs)"] (optional, for private channels)
}
```

**Response (201 Created):**
```json
{
  "channel": {
    "id": "string",
    "name": "string",
    "description": "string | null",
    "type": "public | private",
    "createdBy": "string",
    "memberCount": "number",
    "createdAt": "ISO 8601 timestamp"
  }
}
```

**Requirements:**
- Validate channel name is unique
- Convert name to lowercase
- Add creator as admin member
- If private, add specified members
- If public, allow anyone to join
- Create system message: "Channel created"

---

### 3.3 Get Channel Details
**Endpoint:** `GET /api/chat/channels/:channelId`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response (200 OK):**
```json
{
  "channel": {
    "id": "string",
    "name": "string",
    "description": "string | null",
    "type": "public | private",
    "createdBy": "string",
    "members": [
      {
        "userId": "string",
        "name": "string",
        "email": "string",
        "role": "admin | member",
        "avatar": "string | null",
        "status": "online | away | busy | inmeeting | offline",
        "joinedAt": "ISO 8601 timestamp"
      }
    ],
    "memberCount": "number",
    "createdAt": "ISO 8601 timestamp"
  }
}
```

**Requirements:**
- Verify user is member of channel
- Return 403 if not member and channel is private

---

### 3.4 Update Channel
**Endpoint:** `PUT /api/chat/channels/:channelId`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Request Body (all optional):**
```json
{
  "name": "string",
  "description": "string",
  "type": "public | private"
}
```

**Response (200 OK):**
```json
{
  "channel": { /* updated channel object */ }
}
```

**Requirements:**
- Only channel admins can update
- Validate name uniqueness if changed
- Create system message: "Channel updated"

---

### 3.5 Delete Channel
**Endpoint:** `DELETE /api/chat/channels/:channelId`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

**Requirements:**
- Only channel creator or app admins can delete
- Soft delete (mark as deleted, don't remove data)
- Remove all members
- Archive all messages

---

### 3.6 Add Members to Channel
**Endpoint:** `POST /api/chat/channels/:channelId/members`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Request Body:**
```json
{
  "userIds": ["string (user IDs, required)"],
  "role": "admin | member" (optional, default "member")
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "members": [
    {
      "userId": "string",
      "name": "string",
      "role": "admin | member"
    }
  ]
}
```

**Requirements:**
- Only admins can add members to private channels
- Anyone can join public channels
- Create system message: "{user} joined the channel"
- Send notification to new members

---

### 3.7 Remove Member from Channel
**Endpoint:** `DELETE /api/chat/channels/:channelId/members/:userId`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

**Requirements:**
- Admins can remove any member
- Users can remove themselves (leave channel)
- Cannot remove channel creator
- Create system message: "{user} left the channel"

---

### 3.8 Update Member Role
**Endpoint:** `PUT /api/chat/channels/:channelId/members/:userId`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Request Body:**
```json
{
  "role": "admin | member"
}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

**Requirements:**
- Only channel creator can promote/demote members
- Create system message: "{user} is now an admin"

---

## 💬 4. Messaging APIs

### 4.1 Get Messages
**Endpoint:** `GET /api/chat/channels/:channelId/messages`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Query Parameters:**
```
limit: number (optional, default 50, max 100)
before: string (optional, message ID for pagination)
after: string (optional, message ID for polling)
```

**Response (200 OK):**
```json
{
  "messages": [
    {
      "id": "string (UUID)",
      "channelId": "string",
      "content": "string",
      "userId": "string",
      "user": {
        "id": "string",
        "name": "string",
        "avatar": "string | null"
      },
      "attachments": [
        {
          "id": "string",
          "name": "string",
          "url": "string",
          "size": "number",
          "type": "string (MIME type)"
        }
      ],
      "reactions": [
        {
          "emoji": "string",
          "userId": "string",
          "userName": "string"
        }
      ],
      "threadCount": "number",
      "isPinned": "boolean",
      "isEdited": "boolean",
      "editedAt": "ISO 8601 timestamp | null",
      "linkPreview": {
        "url": "string",
        "title": "string",
        "description": "string",
        "image": "string"
      } | null,
      "scheduledFor": "ISO 8601 timestamp | null",
      "voiceNote": {
        "url": "string",
        "duration": "number (seconds)"
      } | null,
      "createdAt": "ISO 8601 timestamp"
    }
  ],
  "hasMore": "boolean"
}
```

**Requirements:**
- Verify user is channel member
- Return messages in reverse chronological order
- Support pagination with cursor-based pagination
- Include reactions count and user info
- Mark messages as read for requesting user

---

### 4.2 Send Message
**Endpoint:** `POST /api/chat/channels/:channelId/messages/send`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

**Request Body:**
```json
{
  "content": "string (required if no attachments)",
  "attachments": ["string (attachment IDs)"] (optional),
  "scheduledFor": "ISO 8601 timestamp" (optional),
  "parentMessageId": "string (UUID)" (optional, for threads)
}
```

**Response (201 Created):**
```json
{
  "message": {
    "id": "string",
    "channelId": "string",
    "content": "string",
    "userId": "string",
    "attachments": [],
    "reactions": [],
    "threadCount": 0,
    "isPinned": false,
    "isEdited": false,
    "createdAt": "ISO 8601 timestamp"
  }
}
```

**Requirements:**
- Verify user is channel member
- Extract and generate link previews for URLs in content
- Support @mentions (parse and notify mentioned users)
- If scheduledFor provided, store and send later
- If parentMessageId provided, create as thread reply
- Broadcast message via WebSocket to all channel members
- Update channel lastMessage
- Send notifications to mentioned users

---

### 4.3 Edit Message
**Endpoint:** `PUT /api/chat/channels/:channelId/messages/:messageId`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Request Body:**
```json
{
  "content": "string (required)"
}
```

**Response (200 OK):**
```json
{
  "message": { /* updated message */ }
}
```

**Requirements:**
- Only message author can edit
- Can edit within 24 hours of sending
- Mark message as edited with timestamp
- Broadcast edit via WebSocket

---

### 4.4 Delete Message
**Endpoint:** `DELETE /api/chat/channels/:channelId/messages/:messageId`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

**Requirements:**
- Only message author or channel admins can delete
- Soft delete (mark as deleted, preserve for admin audit)
- Broadcast deletion via WebSocket
- Delete associated attachments from storage

---

### 4.5 React to Message
**Endpoint:** `POST /api/chat/channels/:channelId/messages/:messageId/reactions`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Request Body:**
```json
{
  "emoji": "string (required, unicode emoji)"
}
```

**Response (200 OK):**
```json
{
  "reaction": {
    "messageId": "string",
    "userId": "string",
    "emoji": "string",
    "createdAt": "ISO 8601 timestamp"
  }
}
```

**Requirements:**
- User can have only one reaction per message
- If user already reacted, replace with new emoji
- Broadcast reaction via WebSocket

---

### 4.6 Remove Reaction
**Endpoint:** `DELETE /api/chat/channels/:channelId/messages/:messageId/reactions`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

**Requirements:**
- Remove user's reaction from message
- Broadcast removal via WebSocket

---

### 4.7 Pin Message
**Endpoint:** `POST /api/chat/channels/:channelId/messages/:messageId/pin`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

**Requirements:**
- Only channel admins can pin messages
- Max 10 pinned messages per channel
- Create system message: "{user} pinned a message"

---

### 4.8 Unpin Message
**Endpoint:** `DELETE /api/chat/channels/:channelId/messages/:messageId/pin`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

**Requirements:**
- Only channel admins can unpin
- Create system message: "{user} unpinned a message"

---

### 4.9 Get Thread Messages
**Endpoint:** `GET /api/chat/channels/:channelId/messages/:messageId/thread`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response (200 OK):**
```json
{
  "parentMessage": { /* message object */ },
  "replies": [ /* array of message objects */ ],
  "total": "number"
}
```

**Requirements:**
- Return parent message and all replies
- Mark thread messages as read

---

### 4.10 Search Messages
**Endpoint:** `GET /api/chat/search`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Query Parameters:**
```
query: string (required, min 2 chars)
channelId: string (optional, search in specific channel)
from: string (optional, user ID)
before: string (optional, ISO 8601 timestamp)
after: string (optional, ISO 8601 timestamp)
limit: number (optional, default 20, max 50)
```

**Response (200 OK):**
```json
{
  "messages": [ /* array of matching messages with channel info */ ],
  "total": "number"
}
```

**Requirements:**
- Full-text search across message content
- Search only in channels user is member of
- Support filters by user, date range, channel
- Highlight matching text in results
- Use Elasticsearch or similar for performance

---

## 📁 5. File Upload APIs

### 5.1 Upload File
**Endpoint:** `POST /api/upload`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: multipart/form-data
```

**Request Body:**
```
files: File[] (required, max 10 files, max 50MB each)
channelId: string (optional)
```

**Response (200 OK):**
```json
{
  "attachments": [
    {
      "id": "string (UUID)",
      "name": "string",
      "url": "string (CDN URL)",
      "thumbnailUrl": "string | null",
      "size": "number (bytes)",
      "type": "string (MIME type)",
      "uploadedAt": "ISO 8601 timestamp"
    }
  ]
}
```

**Requirements:**
- Validate file types and sizes
- Upload to cloud storage (S3/CloudFlare/GCS)
- Generate thumbnails for images and videos
- Scan files for viruses (ClamAV or similar)
- Return CDN URLs
- Store metadata in database
- Set expiry for unused attachments (7 days)

---

### 5.2 Delete File
**Endpoint:** `DELETE /api/upload/:attachmentId`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

**Requirements:**
- Only file uploader can delete
- Delete from cloud storage
- Remove database record

---

## 📞 6. Real-Time Communication APIs

### 6.1 WebRTC Signaling for Calls
**Endpoint:** WebSocket `/ws/call`

**Events to Implement:**

#### Client → Server Events:
```typescript
// Start a call
{
  "event": "call:start",
  "data": {
    "targetId": "string (user ID or channel ID)",
    "callType": "audio | video",
    "offer": "RTCSessionDescription"
  }
}

// Answer a call
{
  "event": "call:answer",
  "data": {
    "callId": "string",
    "answer": "RTCSessionDescription"
  }
}

// Send ICE candidate
{
  "event": "call:ice-candidate",
  "data": {
    "callId": "string",
    "candidate": "RTCIceCandidate"
  }
}

// End call
{
  "event": "call:end",
  "data": {
    "callId": "string"
  }
}

// Toggle mute
{
  "event": "call:mute",
  "data": {
    "callId": "string",
    "muted": "boolean"
  }
}

// Toggle video
{
  "event": "call:video",
  "data": {
    "callId": "string",
    "enabled": "boolean"
  }
}

// Screen share
{
  "event": "call:screen-share",
  "data": {
    "callId": "string",
    "enabled": "boolean"
  }
}
```

#### Server → Client Events:
```typescript
// Incoming call
{
  "event": "call:incoming",
  "data": {
    "callId": "string",
    "from": {
      "id": "string",
      "name": "string",
      "avatar": "string | null"
    },
    "callType": "audio | video",
    "offer": "RTCSessionDescription"
  }
}

// Call answered
{
  "event": "call:answered",
  "data": {
    "callId": "string",
    "answer": "RTCSessionDescription"
  }
}

// ICE candidate
{
  "event": "call:ice-candidate",
  "data": {
    "callId": "string",
    "candidate": "RTCIceCandidate"
  }
}

// Call ended
{
  "event": "call:ended",
  "data": {
    "callId": "string",
    "reason": "normal | busy | declined | error"
  }
}

// Participant state changed
{
  "event": "call:participant-update",
  "data": {
    "callId": "string",
    "userId": "string",
    "muted": "boolean",
    "videoEnabled": "boolean",
    "screenSharing": "boolean"
  }
}
```

**Requirements:**
- Use WebRTC for peer-to-peer connections
- Implement STUN/TURN servers for NAT traversal
- Store call metadata (start time, end time, participants)
- Support multi-party calls (up to 8 participants)
- Record call history

---

### 6.2 Typing Indicators
**Endpoint:** WebSocket `/ws/typing`

**Events:**

#### Client → Server:
```typescript
{
  "event": "typing:start",
  "data": {
    "channelId": "string"
  }
}

{
  "event": "typing:stop",
  "data": {
    "channelId": "string"
  }
}
```

#### Server → Client:
```typescript
{
  "event": "typing:user",
  "data": {
    "channelId": "string",
    "userId": "string",
    "userName": "string",
    "typing": "boolean"
  }
}
```

**Requirements:**
- Broadcast typing status to channel members
- Auto-stop after 5 seconds of inactivity
- Throttle typing events (max 1 per second)

---

### 6.3 Presence/Status Updates
**Endpoint:** WebSocket `/ws/presence`

**Events:**

#### Client → Server:
```typescript
{
  "event": "presence:update",
  "data": {
    "status": "online | away | busy | inmeeting | offline"
  }
}
```

#### Server → Client:
```typescript
{
  "event": "presence:changed",
  "data": {
    "userId": "string",
    "status": "online | away | busy | inmeeting | offline",
    "lastSeen": "ISO 8601 timestamp"
  }
}
```

**Requirements:**
- Broadcast presence to all users
- Auto-set to "away" after 5 minutes inactive
- Store last seen timestamp

---

## 🎯 7. Advanced Features APIs

### 7.1 Huddles (Audio Rooms)

#### 7.1.1 Start Huddle
**Endpoint:** `POST /api/huddles`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Request Body:**
```json
{
  "channelId": "string (required)",
  "title": "string (optional)"
}
```

**Response (201 Created):**
```json
{
  "huddle": {
    "id": "string (UUID)",
    "channelId": "string",
    "title": "string",
    "createdBy": "string",
    "participants": [],
    "startedAt": "ISO 8601 timestamp"
  }
}
```

---

#### 7.1.2 Join Huddle
**Endpoint:** `POST /api/huddles/:huddleId/join`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response (200 OK):**
```json
{
  "success": true,
  "iceServers": [
    {
      "urls": ["stun:stun.l.google.com:19302"]
    }
  ]
}
```

**Requirements:**
- Add user to participants list
- Broadcast join event via WebSocket
- Return STUN/TURN servers for WebRTC

---

#### 7.1.3 Leave Huddle
**Endpoint:** `POST /api/huddles/:huddleId/leave`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

**Requirements:**
- Remove user from participants
- If last participant, end huddle
- Broadcast leave event

---

### 7.2 Canvas/Docs (Collaborative Documents)

#### 7.2.1 Create Document
**Endpoint:** `POST /api/canvas`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Request Body:**
```json
{
  "title": "string (required)",
  "channelId": "string (required)",
  "content": "string (markdown, optional)"
}
```

**Response (201 Created):**
```json
{
  "document": {
    "id": "string (UUID)",
    "title": "string",
    "channelId": "string",
    "content": "string",
    "createdBy": "string",
    "lastEditedBy": "string",
    "lastEditedAt": "ISO 8601 timestamp",
    "createdAt": "ISO 8601 timestamp"
  }
}
```

---

#### 7.2.2 Get Document
**Endpoint:** `GET /api/canvas/:documentId`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response (200 OK):**
```json
{
  "document": {
    "id": "string",
    "title": "string",
    "channelId": "string",
    "content": "string (markdown)",
    "createdBy": "string",
    "lastEditedBy": "string",
    "lastEditedAt": "ISO 8601 timestamp",
    "collaborators": [
      {
        "userId": "string",
        "name": "string",
        "avatar": "string | null"
      }
    ],
    "createdAt": "ISO 8601 timestamp"
  }
}
```

---

#### 7.2.3 Update Document
**Endpoint:** `PUT /api/canvas/:documentId`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Request Body:**
```json
{
  "title": "string (optional)",
  "content": "string (markdown, optional)"
}
```

**Response (200 OK):**
```json
{
  "document": { /* updated document */ }
}
```

**Requirements:**
- Implement operational transformation (OT) or CRDT for real-time collaboration
- Broadcast changes via WebSocket to all editors
- Store version history (last 50 versions)

---

#### 7.2.4 List Documents
**Endpoint:** `GET /api/canvas`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Query Parameters:**
```
channelId: string (optional)
limit: number (optional, default 20)
offset: number (optional, default 0)
```

**Response (200 OK):**
```json
{
  "documents": [ /* array of document objects */ ],
  "total": "number"
}
```

---

#### 7.2.5 Delete Document
**Endpoint:** `DELETE /api/canvas/:documentId`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

**Requirements:**
- Only creator or channel admins can delete

---

### 7.3 Clips (Video/Audio Recordings)

#### 7.3.1 Upload Clip
**Endpoint:** `POST /api/clips`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: multipart/form-data
```

**Request Body:**
```
file: File (required, max 100MB, video/audio)
channelId: string (required)
title: string (optional)
```

**Response (201 Created):**
```json
{
  "clip": {
    "id": "string (UUID)",
    "url": "string (CDN URL)",
    "thumbnailUrl": "string | null",
    "duration": "number (seconds)",
    "type": "video | audio",
    "title": "string",
    "uploadedBy": "string",
    "createdAt": "ISO 8601 timestamp"
  }
}
```

**Requirements:**
- Transcode videos to multiple resolutions (480p, 720p, 1080p)
- Generate thumbnails and waveforms
- Store on cloud storage
- Set expiry (90 days for free tier)

---

#### 7.3.2 Get Clips
**Endpoint:** `GET /api/clips`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Query Parameters:**
```
channelId: string (optional)
limit: number (optional, default 20)
```

**Response (200 OK):**
```json
{
  "clips": [ /* array of clip objects */ ]
}
```

---

#### 7.3.3 Delete Clip
**Endpoint:** `DELETE /api/clips/:clipId`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

---

### 7.4 Voice Messages

#### 7.4.1 Upload Voice Message
**Endpoint:** `POST /api/voice-messages`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: multipart/form-data
```

**Request Body:**
```
audio: File (required, max 10MB, audio/webm or audio/ogg)
channelId: string (required)
duration: number (seconds, required)
```

**Response (201 Created):**
```json
{
  "voiceMessage": {
    "id": "string (UUID)",
    "url": "string (CDN URL)",
    "duration": "number",
    "waveform": "array<number> (amplitude data for visualization)",
    "uploadedBy": "string",
    "createdAt": "ISO 8601 timestamp"
  }
}
```

**Requirements:**
- Convert to common format (MP3)
- Generate waveform data for UI visualization
- Compress audio files

---

### 7.5 Message Scheduling

#### 7.5.1 Schedule Message
**Endpoint:** `POST /api/scheduled-messages`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Request Body:**
```json
{
  "channelId": "string (required)",
  "content": "string (required)",
  "scheduledFor": "ISO 8601 timestamp (required)",
  "attachments": ["string (attachment IDs)"] (optional)
}
```

**Response (201 Created):**
```json
{
  "scheduledMessage": {
    "id": "string",
    "channelId": "string",
    "content": "string",
    "scheduledFor": "ISO 8601 timestamp",
    "status": "pending",
    "createdAt": "ISO 8601 timestamp"
  }
}
```

**Requirements:**
- Store in database with status "pending"
- Use background job (cron/queue) to send at scheduled time
- Allow canceling before send time

---

#### 7.5.2 List Scheduled Messages
**Endpoint:** `GET /api/scheduled-messages`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response (200 OK):**
```json
{
  "messages": [
    {
      "id": "string",
      "channelId": "string",
      "content": "string",
      "scheduledFor": "ISO 8601 timestamp",
      "status": "pending | sent | cancelled",
      "createdAt": "ISO 8601 timestamp"
    }
  ]
}
```

---

#### 7.5.3 Cancel Scheduled Message
**Endpoint:** `DELETE /api/scheduled-messages/:messageId`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

**Requirements:**
- Only allow cancel if status is "pending"

---

### 7.6 AI Assistant Integration

#### 7.6.1 Process AI Prompt
**Endpoint:** `POST /api/ai/process`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Request Body:**
```json
{
  "prompt": "string (required)",
  "context": {
    "channelId": "string (optional)",
    "messageHistory": ["string (message IDs)"] (optional, for context)
  }
}
```

**Response (200 OK):**
```json
{
  "response": "string (AI generated text)",
  "tokensUsed": "number",
  "model": "string (model version used)"
}
```

**Requirements:**
- Integrate with OpenAI API or similar
- Rate limit: 50 requests per user per hour
- Store prompts and responses for billing/analytics
- Sanitize prompts for safety

---

## 🔧 8. Admin & Monitoring APIs

### 8.1 Admin Dashboard Stats
**Endpoint:** `GET /api/admin/stats`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response (200 OK):**
```json
{
  "users": {
    "total": "number",
    "active": "number (last 30 days)",
    "new": "number (last 7 days)"
  },
  "channels": {
    "total": "number",
    "public": "number",
    "private": "number"
  },
  "messages": {
    "total": "number",
    "today": "number",
    "averagePerDay": "number"
  },
  "storage": {
    "used": "number (bytes)",
    "limit": "number (bytes)"
  }
}
```

**Requirements:**
- Only accessible by admin users
- Cache results (5 minute TTL)

---

### 8.2 List All Users (Admin)
**Endpoint:** `GET /api/admin/users`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Query Parameters:**
```
status: "active" | "suspended" | "all" (optional, default "all")
limit: number (optional, default 50)
offset: number (optional, default 0)
search: string (optional)
```

**Response (200 OK):**
```json
{
  "users": [
    {
      "id": "string",
      "email": "string",
      "name": "string",
      "role": "admin | user",
      "status": "active | suspended",
      "emailVerified": "boolean",
      "lastLogin": "ISO 8601 timestamp",
      "createdAt": "ISO 8601 timestamp"
    }
  ],
  "total": "number"
}
```

---

### 8.3 Suspend User (Admin)
**Endpoint:** `POST /api/admin/users/:userId/suspend`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Request Body:**
```json
{
  "reason": "string (required)"
}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

**Requirements:**
- Only admin can suspend
- Invalidate all user sessions
- Send email notification to user
- Log action in audit log

---

### 8.4 Activate User (Admin)
**Endpoint:** `POST /api/admin/users/:userId/activate`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

---

### 8.5 Delete User (Admin)
**Endpoint:** `DELETE /api/admin/users/:userId`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

**Requirements:**
- Soft delete user account
- Anonymize user data (GDPR compliance)
- Remove from all channels
- Delete all messages (or anonymize)

---

### 8.6 System Health Check
**Endpoint:** `GET /api/health`

**Response (200 OK):**
```json
{
  "status": "healthy | degraded | down",
  "uptime": "number (seconds)",
  "version": "string",
  "timestamp": "ISO 8601 timestamp",
  "services": {
    "database": {
      "status": "up | down",
      "latency": "number (ms)"
    },
    "redis": {
      "status": "up | down",
      "latency": "number (ms)"
    },
    "storage": {
      "status": "up | down"
    },
    "websocket": {
      "status": "up | down",
      "connections": "number"
    }
  }
}
```

**Requirements:**
- Publicly accessible (no auth)
- Check all critical services
- Return 503 if any critical service is down

---

### 8.7 Ops Metrics
**Endpoint:** `GET /api/metrics`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response (200 OK):**
```json
{
  "activeConnections": "number",
  "totalMessages": "number",
  "messagesPerSecond": "number",
  "averageLatency": "number (ms)",
  "errorRate": "number (percentage)",
  "cpuUsage": "number (percentage)",
  "memoryUsage": "number (bytes)"
}
```

**Requirements:**
- Only accessible by admin
- Use Prometheus or similar for metrics collection

---

## 📊 9. Notification APIs

### 9.1 Get Notification Settings
**Endpoint:** `GET /api/notifications/settings`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response (200 OK):**
```json
{
  "settings": {
    "enabled": "boolean",
    "soundEnabled": "boolean",
    "channels": {
      "[channelId]": {
        "enabled": "boolean",
        "mentions": "all | mentions | nothing"
      }
    },
    "dnd": {
      "enabled": "boolean",
      "startTime": "HH:mm",
      "endTime": "HH:mm"
    }
  }
}
```

---

### 9.2 Update Notification Settings
**Endpoint:** `PUT /api/notifications/settings`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Request Body:**
```json
{
  "enabled": "boolean (optional)",
  "soundEnabled": "boolean (optional)",
  "channels": "object (optional)",
  "dnd": "object (optional)"
}
```

**Response (200 OK):**
```json
{
  "settings": { /* updated settings */ }
}
```

---

### 9.3 Get Unread Notifications
**Endpoint:** `GET /api/notifications`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response (200 OK):**
```json
{
  "notifications": [
    {
      "id": "string",
      "type": "mention | dm | reaction | thread_reply",
      "message": "string",
      "channelId": "string | null",
      "messageId": "string | null",
      "read": "boolean",
      "createdAt": "ISO 8601 timestamp"
    }
  ],
  "unreadCount": "number"
}
```

---

### 9.4 Mark Notifications as Read
**Endpoint:** `PUT /api/notifications/read`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Request Body:**
```json
{
  "notificationIds": ["string (notification IDs)"]
}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

---

## 🔗 10. Direct Message (DM) APIs

### 10.1 Create/Get DM Channel
**Endpoint:** `POST /api/dms`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Request Body:**
```json
{
  "userId": "string (required, recipient user ID)"
}
```

**Response (200 OK):**
```json
{
  "dm": {
    "id": "string (UUID)",
    "participants": [
      {
        "userId": "string",
        "name": "string",
        "avatar": "string | null",
        "status": "online | away | busy | inmeeting | offline"
      }
    ],
    "lastMessage": { /* message object */ } | null,
    "unreadCount": "number",
    "createdAt": "ISO 8601 timestamp"
  }
}
```

**Requirements:**
- Check if DM channel already exists between users
- If exists, return existing channel
- If not, create new DM channel
- DM channels are always private

---

### 10.2 List DM Channels
**Endpoint:** `GET /api/dms`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response (200 OK):**
```json
{
  "dms": [
    {
      "id": "string",
      "participant": {
        "userId": "string",
        "name": "string",
        "avatar": "string | null",
        "status": "online | away | busy | inmeeting | offline"
      },
      "lastMessage": { /* message object */ } | null,
      "unreadCount": "number",
      "createdAt": "ISO 8601 timestamp"
    }
  ]
}
```

**Requirements:**
- Return only DM channels for current user
- Sort by last activity

---

## 🔐 11. Security & Rate Limiting

### Rate Limits (per user):
- Authentication: 5 login attempts per 15 minutes
- Message sending: 100 messages per minute
- File uploads: 20 uploads per hour
- API calls (general): 1000 requests per hour
- AI prompts: 50 requests per hour

### Security Requirements:
- All endpoints require JWT authentication (except auth endpoints)
- JWT tokens expire after 7 days
- Refresh tokens valid for 30 days
- HTTPS only in production
- CORS configured for frontend domains only
- Implement rate limiting with Redis
- SQL injection prevention (use parameterized queries)
- XSS prevention (sanitize user input)
- CSRF protection with tokens
- Encrypt sensitive data at rest
- Hash passwords with bcrypt (salt rounds: 10+)
- Implement API key authentication for external integrations
- Log all authentication attempts
- Implement audit logging for admin actions

---

## 📝 12. WebSocket Events Summary

### Connection:
```
ws://api.example.com/ws?token={JWT_TOKEN}
```

### Event Namespaces:
- `/ws/call` - WebRTC signaling for audio/video calls
- `/ws/typing` - Typing indicators
- `/ws/presence` - User presence/status updates
- `/ws/messages` - Real-time message updates
- `/ws/notifications` - Push notifications

### Message Events:
```typescript
// New message
{
  "event": "message:new",
  "data": { /* message object */ }
}

// Message updated
{
  "event": "message:updated",
  "data": { /* message object */ }
}

// Message deleted
{
  "event": "message:deleted",
  "data": {
    "messageId": "string",
    "channelId": "string"
  }
}

// Reaction added
{
  "event": "message:reaction",
  "data": {
    "messageId": "string",
    "channelId": "string",
    "reaction": { /* reaction object */ }
  }
}
```

---

## 🎯 Implementation Priority

### Phase 1 (Critical - 2 weeks):
1. Authentication APIs (register, login, JWT)
2. User management (profile, status)
3. Channel CRUD operations
4. Basic messaging (send, list)
5. WebSocket connection setup
6. File uploads

### Phase 2 (Essential - 3 weeks):
7. Real-time messaging via WebSocket
8. Reactions and threads
9. Typing indicators and presence
10. Search functionality
11. Direct messages
12. Notifications

### Phase 3 (Advanced - 4 weeks):
13. WebRTC signaling for calls
14. Message editing and deletion
15. Pinned messages
16. Scheduled messages
17. Voice messages
18. Admin dashboard

### Phase 4 (Extended - 4 weeks):
19. Huddles (audio rooms)
20. Canvas/Docs (collaborative editing)
21. Clips (video/audio recordings)
22. AI assistant integration
23. Advanced search with Elasticsearch
24. Analytics and metrics

---

## 🛠️ Technology Stack Recommendations

### Backend Framework:
- **FastAPI (Python)** - High performance, async support, automatic OpenAPI docs
- **Alternative:** Django REST Framework for more batteries-included approach

### Database:
- **PostgreSQL** - Primary relational database
- **Redis** - Caching, rate limiting, session storage, pub/sub for WebSocket
- **Elasticsearch** - Full-text search for messages

### File Storage:
- **AWS S3** or **CloudFlare R2** - Object storage for files
- **CloudFlare Images** - Image optimization and CDN

### Real-Time:
- **Socket.IO** or **WebSocket (native)** - Real-time communication
- **Redis Pub/Sub** - Message broadcasting across multiple server instances

### WebRTC:
- **Coturn** - TURN/STUN server for NAT traversal
- **Mediasoup** or **Jitsi** - Media server for multi-party calls

### Task Queue:
- **Celery** with **Redis** - Background jobs (scheduled messages, email sending)

### Monitoring:
- **Prometheus** + **Grafana** - Metrics and visualization
- **Sentry** - Error tracking
- **ELK Stack** - Log aggregation

### Email:
- **SendGrid** or **Amazon SES** - Transactional emails

### AI/ML:
- **OpenAI API** - GPT-4 for AI assistant
- **Anthropic Claude** - Alternative AI model

---

## 📚 API Documentation
- Use **Swagger/OpenAPI 3.0** for API documentation
- Generate interactive API docs at `/api/docs`
- Include request/response examples for all endpoints
- Document all error codes and messages
- Provide Postman collection for testing

---

## ✅ Testing Requirements
- Unit tests for all API endpoints (pytest)
- Integration tests for critical flows
- Load testing for high-traffic endpoints (Locust)
- WebSocket connection testing
- File upload/download testing
- Security testing (OWASP Top 10)
- 80%+ code coverage target

---

This document provides complete specifications for the backend team to implement a production-ready API for the ConnectBest Chat application.
