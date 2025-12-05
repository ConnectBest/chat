# API Documentation

Complete API reference and specification documents for the ConnectBest Chat backend.

## 📖 Available Documentation

### API Specifications
- **[BACKEND_API_REQUIREMENTS.md](BACKEND_API_REQUIREMENTS.md)** - Complete API requirements, endpoint specifications, and data models
- **[API_REFERENCE.md](API_REFERENCE.md)** - Detailed API reference with request/response examples

## 🌐 API Overview

### Base URL
- **Development**: `http://localhost:5001/api`
- **Production**: `https://chat.connect-best.com/api`

### Authentication
All protected endpoints require JWT token in Authorization header:
```
Authorization: Bearer <jwt_token>
```

### Content Type
```
Content-Type: application/json
```

## 📡 Endpoint Categories

### Authentication Endpoints
- `POST /auth/register` - User registration
- `POST /auth/login` - User authentication
- `GET /auth/me` - Current user profile
- `POST /auth/refresh` - Token refresh

### User Management
- `GET /users` - List users (admin)
- `PUT /users/profile` - Update user profile
- `GET /users/{id}` - Get user details

### Channel Operations
- `GET /channels` - List channels
- `POST /channels` - Create channel
- `PUT /channels/{id}` - Update channel
- `POST /channels/{id}/join` - Join channel
- `POST /channels/{id}/leave` - Leave channel

### Messaging
- `GET /channels/{id}/messages` - Get channel messages
- `POST /channels/{id}/messages` - Send message
- `PUT /messages/{id}` - Edit message
- `DELETE /messages/{id}` - Delete message

### File Uploads
- `POST /upload` - Upload file
- `GET /files/{id}` - Get file metadata

## 🔍 Interactive Testing

### Swagger UI
Access interactive API documentation at:
- **Development**: `http://localhost:5001/docs`
- **Production**: `https://chat.connect-best.com/docs`

### Testing Tools
- **Postman Collection**: Import API endpoints for testing
- **cURL Examples**: Command-line testing examples in documentation
- **Frontend Integration**: API client in `lib/api.ts`