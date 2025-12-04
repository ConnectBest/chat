# 📡 API Endpoints Reference

## Base URL
```
http://localhost:5000/api
```

## 🔐 Authentication Endpoints

### Register New User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "John Doe",
  "phone": "+1234567890",  // optional
  "role": "user"           // optional, default: "user"
}

Response: 201 Created
{
  "message": "User registered successfully",
  "user": { ... },
  "token": "eyJhbGci..."
}
```

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123"
}

Response: 200 OK
{
  "user": { ... },
  "token": "eyJhbGci..."
}
```

### Get Current User
```http
GET /api/auth/me
Authorization: Bearer {token}

Response: 200 OK
{
  "user": {
    "id": "...",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "status": "online"
  }
}
```

### Logout
```http
POST /api/auth/logout
Authorization: Bearer {token}

Response: 200 OK
{
  "message": "Logged out successfully"
}
```

---

## 👤 User Endpoints

### Get User Profile
```http
GET /api/users/profile
Authorization: Bearer {token}

Response: 200 OK
{
  "user": { ... }
}
```

### Update User Profile
```http
PUT /api/users/profile
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "New Name",
  "phone": "+9876543210",
  "status_message": "Busy working"
}

Response: 200 OK
{
  "user": { ... }
}
```

### Search Users
```http
GET /api/users/search?query=john&limit=20
Authorization: Bearer {token}

Response: 200 OK
{
  "users": [
    {
      "id": "...",
      "name": "John Doe",
      "email": "john@example.com",
      "status": "online"
    }
  ]
}
```

---

## 📢 Channel Endpoints

### List User's Channels
```http
GET /api/chat/channels
Authorization: Bearer {token}

Response: 200 OK
{
  "channels": [
    {
      "id": "...",
      "name": "general",
      "description": "General discussion",
      "type": "public",
      "created_by": "...",
      "member_role": "admin"
    }
  ]
}
```

### Create Channel
```http
POST /api/chat/channels
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "project-alpha",
  "description": "Project Alpha discussions",
  "type": "public"  // or "private"
}

Response: 201 Created
{
  "channel": { ... }
}
```

### Get Channel Details
```http
GET /api/chat/channels/{channel_id}
Authorization: Bearer {token}

Response: 200 OK
{
  "channel": {
    "id": "...",
    "name": "general",
    "description": "...",
    "type": "public",
    "members": [
      {
        "user_id": "...",
        "name": "John Doe",
        "role": "admin",
        "joined_at": "2024-01-15T..."
      }
    ]
  }
}
```

### Join Channel
```http
POST /api/chat/channels/{channel_id}/join
Authorization: Bearer {token}

Response: 200 OK
{
  "message": "Joined channel successfully"
}
```

---

## 💬 Message Endpoints

### Get Channel Messages
```http
GET /api/chat/channels/{channel_id}/messages?limit=50&before={message_id}
Authorization: Bearer {token}

Query Parameters:
- limit: Max messages to return (default: 50)
- before: Message ID for pagination (optional)

Response: 200 OK
{
  "messages": [
    {
      "id": "...",
      "channel_id": "...",
      "user_id": "...",
      "user": {
        "id": "...",
        "name": "John Doe",
        "avatar_url": null
      },
      "content": "Hello, world!",
      "is_edited": false,
      "is_pinned": false,
      "created_at": "2024-01-15T10:30:00Z",
      "reactions": [],
      "reaction_count": 0
    }
  ]
}
```

### Send Message
```http
POST /api/chat/channels/{channel_id}/messages/send
Authorization: Bearer {token}
Content-Type: application/json

{
  "content": "Hello, this is my message!",
  "parent_message_id": "..."  // optional, for threaded replies
}

Response: 201 Created
{
  "message": { ... }
}
```

### Get Specific Message
```http
GET /api/messages/{message_id}
Authorization: Bearer {token}

Response: 200 OK
{
  "message": { ... }
}
```

### Edit Message
```http
PUT /api/messages/{message_id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "content": "Updated message content"
}

Response: 200 OK
{
  "message": { ... }
}
```

### Delete Message
```http
DELETE /api/messages/{message_id}
Authorization: Bearer {token}

Response: 200 OK
{
  "message": "Message deleted successfully"
}
```

---

## ❤️ Health Check

### Server Health
```http
GET /api/health

Response: 200 OK
{
  "status": "healthy",
  "database": "connected",
  "message": "Chat API is running"
}
```

---

## 🔒 Authentication Flow

### 1. Register or Login
```javascript
// Get token from response
const response = await fetch('http://localhost:5000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123'
  })
});

const data = await response.json();
const token = data.token;  // Save this!
```

### 2. Use Token for Protected Routes
```javascript
// Include token in Authorization header
const response = await fetch('http://localhost:5000/api/chat/channels', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,  // Important: "Bearer " prefix!
    'Content-Type': 'application/json'
  }
});
```

### 3. Handle Token Expiration
```javascript
// If you get 401 Unauthorized, token is expired
// User needs to login again
if (response.status === 401) {
  // Redirect to login
  // Clear stored token
}
```

---

## 📊 Response Status Codes

| Code | Meaning | When it happens |
|------|---------|----------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created (user, channel, message) |
| 400 | Bad Request | Invalid input, validation error |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Valid token but no permission |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate (e.g., email already exists) |
| 500 | Server Error | Something went wrong on server |

---

## 🧪 Testing with cURL

### Register
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456",
    "name": "Test User"
  }'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456"
  }'
```

### Get Channels (with token)
```bash
TOKEN="your-token-here"

curl -X GET http://localhost:5000/api/chat/channels \
  -H "Authorization: Bearer $TOKEN"
```

### Create Channel
```bash
curl -X POST http://localhost:5000/api/chat/channels \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-channel",
    "description": "Test channel",
    "type": "public"
  }'
```

### Send Message
```bash
CHANNEL_ID="your-channel-id"

curl -X POST http://localhost:5000/api/chat/channels/$CHANNEL_ID/messages/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Hello from cURL!"
  }'
```

---

## 💡 Tips

1. **Always use HTTPS in production**
2. **Store tokens securely** (localStorage or httpOnly cookies)
3. **Handle token expiration** gracefully
4. **Validate input** on both client and server
5. **Use proper HTTP methods** (GET for reading, POST for creating, PUT for updating, DELETE for deleting)
6. **Check response status** before parsing JSON
7. **Handle errors** gracefully with user-friendly messages

---

## 📚 More Details

- **Swagger UI**: http://localhost:5000/docs (Interactive documentation)
- **API Spec**: http://localhost:5000/swagger.json (OpenAPI specification)
- **Learning Guide**: See LEARNING_GUIDE.md for detailed explanations
