# Chat Application Backend - Flask + MongoDB

A complete backend implementation for a real-time chat application with Swagger documentation.

## 🚀 Features

- **REST API** with Flask-RESTX (Swagger UI included)
- **MongoDB** for data persistence
- **JWT Authentication** for secure user sessions
- **Password Hashing** with bcrypt
- **Input Validation** with Marshmallow
- **CORS** enabled for frontend integration
- **Comprehensive Error Handling**
- **User Management** (register, login, profile)
- **Channel Management** (create, list, join channels)
- **Messaging** (send, list, edit, delete messages)
- **Real-time features** ready (WebSocket support structure)

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

1. **Python 3.8+** - [Download Python](https://www.python.org/downloads/)
2. **MongoDB** - [Install MongoDB](https://www.mongodb.com/docs/manual/installation/)
   - Local installation OR MongoDB Atlas (cloud)
3. **pip** (Python package manager - comes with Python)
4. **Git** (optional but recommended)

## 🛠️ Installation & Setup

### Step 1: Clone or Navigate to Project

```bash
cd /Users/spartan/Desktop/Project\ frontend\ copy/chat-backend
```

### Step 2: Create Virtual Environment

A virtual environment keeps your project dependencies isolated.

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate

# On Windows:
# venv\Scripts\activate

# You should see (venv) in your terminal prompt
```

### Step 3: Install Dependencies

```bash
pip install -r requirements.txt
```

This will install all the required packages:
- Flask (web framework)
- Flask-RESTX (Swagger documentation)
- PyMongo (MongoDB driver)
- PyJWT (authentication tokens)
- bcrypt (password hashing)
- and more...

### Step 4: Set Up MongoDB

#### Option A: Local MongoDB

1. **Start MongoDB service:**
   ```bash
   # On macOS with Homebrew:
   brew services start mongodb-community
   
   # On Linux:
   sudo systemctl start mongod
   
   # On Windows:
   # MongoDB runs as a service automatically
   ```

2. **Verify MongoDB is running:**
   ```bash
   mongosh
   # You should see MongoDB shell
   # Type 'exit' to leave
   ```

#### Option B: MongoDB Atlas (Cloud - Recommended for Beginners)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account
3. Create a new cluster (Free tier is sufficient)
4. Click "Connect" → "Connect your application"
5. Copy the connection string (looks like: `mongodb+srv://...`)
6. Replace `<password>` with your database password

### Step 5: Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env file with your settings
# For macOS:
nano .env

# For Windows:
# notepad .env
```

**Minimal .env configuration:**

```env
SECRET_KEY=my-super-secret-key-12345
JWT_SECRET_KEY=my-jwt-secret-12345
MONGODB_URI=mongodb://localhost:27017/chatapp
CORS_ORIGINS=http://localhost:3000
```

**For MongoDB Atlas, use:**
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/chatapp?retryWrites=true&w=majority
```

### Step 6: Initialize Database

```bash
# Run the database initialization script
python init_db.py
```

This will:
- Connect to MongoDB
- Create necessary collections
- Create indexes for performance
- Add sample data (optional)

### Step 7: Run the Application

```bash
python app.py
```

You should see:
```
 * Running on http://127.0.0.1:5000
 * Swagger UI available at http://127.0.0.1:5000/docs
```

## 📖 API Documentation

Once the server is running, visit:

- **Swagger UI:** http://localhost:5000/docs
- **Swagger JSON:** http://localhost:5000/swagger.json

The Swagger UI provides:
- Interactive API documentation
- Ability to test endpoints directly
- Request/response examples
- Authentication testing

## 🔐 Authentication Flow

### 1. Register a New User

**POST** `/api/auth/register`

```json
{
  "email": "john@example.com",
  "password": "SecurePass123",
  "name": "John Doe",
  "phone": "+1234567890"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "userId": "507f1f77bcf86cd799439011",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### 2. Login

**POST** `/api/auth/login`

```json
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "john@example.com",
    "name": "John Doe",
    "role": "user"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### 3. Use Token for Protected Routes

Add the token to the **Authorization** header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

In Swagger UI:
1. Click the "Authorize" button (🔒)
2. Enter: `Bearer <your-token>`
3. Click "Authorize"

## 📚 Project Structure Explained

```
chat-backend/
├── app.py                 # Main application entry point
├── config.py             # Configuration settings
├── requirements.txt      # Python dependencies
├── .env                  # Environment variables (not in git)
├── init_db.py           # Database initialization script
│
├── models/              # Database models (MongoDB schemas)
│   ├── __init__.py
│   ├── user.py         # User model
│   ├── channel.py      # Channel model
│   └── message.py      # Message model
│
├── routes/              # API endpoints (controllers)
│   ├── __init__.py
│   ├── auth.py         # Authentication endpoints
│   ├── users.py        # User management
│   ├── channels.py     # Channel operations
│   └── messages.py     # Messaging endpoints
│
├── utils/               # Helper functions
│   ├── __init__.py
│   ├── auth.py         # JWT helpers
│   ├── validators.py   # Input validation
│   └── decorators.py   # Custom decorators
│
└── tests/               # Unit tests
    ├── __init__.py
    ├── test_auth.py
    ├── test_channels.py
    └── test_messages.py
```

## 🧪 Testing the API

### Using Swagger UI (Easiest)

1. Open http://localhost:5000/docs
2. Find an endpoint (e.g., `POST /api/auth/register`)
3. Click "Try it out"
4. Fill in the request body
5. Click "Execute"
6. See the response below

### Using cURL

```bash
# Register a user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456",
    "name": "Test User"
  }'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456"
  }'

# Get current user (protected route)
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Using Postman

1. Download [Postman](https://www.postman.com/downloads/)
2. Import the API collection (File → Import)
3. Set environment variable `baseUrl` to `http://localhost:5000`
4. Test endpoints

## 🔧 Database Management

### View Database Contents

```bash
# Connect to MongoDB shell
mongosh

# Switch to your database
use chatapp

# View collections
show collections

# Find all users
db.users.find().pretty()

# Find all channels
db.channels.find().pretty()

# Count messages
db.messages.countDocuments()
```

### Reset Database

```bash
# Drop the entire database
mongosh
use chatapp
db.dropDatabase()

# Re-initialize
python init_db.py
```

## 🐛 Troubleshooting

### Issue: "Connection refused" when starting app

**Solution:** MongoDB is not running
```bash
# Start MongoDB
brew services start mongodb-community  # macOS
sudo systemctl start mongod            # Linux
```

### Issue: "Module not found" errors

**Solution:** Virtual environment not activated or dependencies not installed
```bash
source venv/bin/activate
pip install -r requirements.txt
```

### Issue: "Unauthorized" on protected routes

**Solution:** Token expired or not included
1. Get a new token by logging in again
2. Make sure to include `Bearer ` prefix
3. Check token is not expired (7 days default)

### Issue: CORS errors in frontend

**Solution:** Update CORS_ORIGINS in .env
```env
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

## 📊 MongoDB Collections Overview

### Users Collection
Stores user accounts, profiles, and authentication data.

**Fields:**
- `_id`: Unique user ID (auto-generated)
- `email`: User email (unique, indexed)
- `password_hash`: Encrypted password
- `name`: User's full name
- `role`: "admin" or "user"
- `created_at`: Registration timestamp

### Channels Collection
Stores chat channels/rooms.

**Fields:**
- `_id`: Unique channel ID
- `name`: Channel name (unique)
- `description`: Channel description
- `type`: "public" or "private"
- `created_by`: User ID who created channel
- `created_at`: Creation timestamp

### Messages Collection
Stores all chat messages.

**Fields:**
- `_id`: Unique message ID
- `channel_id`: Reference to channel
- `user_id`: Reference to user who sent
- `content`: Message text
- `is_edited`: Boolean flag
- `created_at`: Sent timestamp

### Channel Members Collection
Tracks which users are in which channels.

**Fields:**
- `channel_id`: Reference to channel
- `user_id`: Reference to user
- `role`: "admin" or "member"
- `joined_at`: When user joined

## 🚀 Production Deployment

### Using Gunicorn (Production WSGI Server)

```bash
# Install gunicorn (already in requirements.txt)
pip install gunicorn

# Run with gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Environment Variables for Production

```env
FLASK_ENV=production
DEBUG=False
SECRET_KEY=<generate-strong-random-key>
JWT_SECRET_KEY=<generate-strong-random-key>
```

Generate secure keys:
```python
import secrets
print(secrets.token_urlsafe(32))
```

## 📈 Next Steps & Extensions

1. **Add WebSocket support** for real-time messaging (Socket.IO)
2. **Implement file uploads** for attachments
3. **Add Redis** for caching and sessions
4. **Implement rate limiting** to prevent abuse
5. **Add email verification** for new users
6. **Implement password reset** functionality
7. **Add user profiles** with avatars
8. **Message reactions** and threads
9. **Search functionality** across messages
10. **Admin dashboard** for user management

## 📞 Support

If you encounter any issues:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review server logs in terminal
3. Check MongoDB logs: `tail -f /usr/local/var/log/mongodb/mongo.log`
4. Ensure all environment variables are set correctly

## 📄 License

MIT License - Feel free to use this for learning and commercial projects!

---

**Happy Coding! 🎉**
