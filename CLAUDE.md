# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is a **full-stack real-time chat application** using a monorepo structure with Next.js 15 frontend and Flask backend.

### Technology Stack
- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, NextAuth.js
- **Backend**: Flask (Python 3.8+), Socket.IO, PyMongo
- **Database**: MongoDB (with enhanced schema for threads, reactions, file attachments, embeddings)
- **Real-time**: Socket.IO (eventlet async mode) + AWS WebSocket API (API Gateway + Lambda)
- **Authentication**: NextAuth with Credentials + Google OAuth, JWT tokens, 2FA support
- **Deployment**: Docker containers → AWS ECR Public → AWS ECS Fargate

### Key Architectural Patterns

**Frontend → Backend Communication**:
1. **REST API**: Next.js App Router routes in `api/` proxy to Flask backend at `http://localhost:5001/api`
2. **Authentication Flow**: NextAuth handles session → passes JWT token from Flask in `accessToken` field
3. **WebSocket**: Socket.IO connects to Flask for real-time messaging
4. **AWS WebSocket API**: Separate serverless WebSocket for production (Lambda + DynamoDB)

**Database Schema** (MongoDB):
- `users` - User accounts with bcrypt passwords, roles (admin/user), 2FA secrets, OAuth data
- `channels` - Chat channels (public/private) with member tracking
- `messages` - Messages with thread support (`parent_message_id`), soft deletes, edit tracking
- `message_reactions` - Emoji reactions on messages
- `message_files` - File attachments metadata (S3/Cloudinary URLs)
- `message_embeddings` - Vector embeddings for semantic search
- `user_channel_read` - Read receipts per user per channel
- `threads` - Thread metadata (reply counts, participants)
- `files` - Uploaded file metadata

**Authentication**:
- NextAuth session stored in cookies (`next-auth.session-token`)
- Flask JWT tokens stored in session's `accessToken` field
- Middleware (`middleware.ts`) protects routes: `/chat`, `/profile`, `/admin`, `/ops`
- Backend validates JWT on protected endpoints using `@token_required` decorator

## Development Commands

### Frontend Development
```bash
# Install dependencies
npm install

# Run dev server (port 3000)
npm run dev

# Production build
npm run build

# Production server (port 8080)
npm start

# Linting and formatting
npm run lint
npm run format
```

### Backend Development
```bash
cd backend

# Create/activate virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Initialize/setup database
python init_db.py

# Run Flask dev server (port 5001)
python app.py

# Production server with gunicorn
gunicorn -k geventwebsocket.gunicorn.workers.GeventWebSocketWorker -w 1 app:app
```

### Database Management
```bash
cd backend

# Export current schema snapshot
python scripts/export_schema.py

# Compare schema with last snapshot
python scripts/compare_schema.py

# Migrate schema to enhanced version
python scripts/migrate_schema.py
```

### Testing
Currently no automated tests. Manual testing via:
- Frontend: Browse UI flows at `http://localhost:3000`
- Backend: Use Swagger UI at `http://localhost:5001/docs`
- API: Use curl or Postman against `http://localhost:5001/api`

### WebSocket API (AWS)
```bash
cd websocket-api

# Install Lambda dependencies
cd src/handlers && npm install && cd ../..

# Build and deploy to AWS
sam build
sam deploy --guided

# View logs
sam logs -n ConnectFunction --stack-name connectbest-websocket --tail
sam logs -n MessageFunction --stack-name connectbest-websocket --tail
```

## Important File Locations

**Frontend**:
- `app/` - Next.js App Router pages and layouts
  - `app/(auth)/` - Public auth pages (login, register, verify-email)
  - `app/(app)/` - Protected app pages (chat, admin, ops, profile)
  - `app/api/` - API route handlers (mostly proxies to Flask)
- `components/` - React components (ui/, chat/, providers/)
- `lib/` - Utilities (auth.ts, api.ts, apiConfig.ts, mongodb.ts)
- `middleware.ts` - Route protection middleware

**Backend**:
- `backend/app.py` - Main Flask application factory
- `backend/config.py` - Configuration with environment-based settings
- `backend/routes/` - API blueprints (auth, channels, messages, users, direct_messages, upload, two_factor, google_oauth)
- `backend/models/` - MongoDB data models (user, channel, message, thread, reaction, file, etc.)
- `backend/utils/` - Helper modules (auth, validators, email_service, two_factor, google_oauth)

**WebSocket**:
- `websocket-api/template.yaml` - AWS SAM template for serverless WebSocket
- `websocket-api/src/handlers/` - Lambda functions for WebSocket events

**Configuration**:
- `.env.local` - Frontend environment variables (NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL, GOOGLE_CLIENT_ID)
- `backend/.env` - Backend environment variables (MONGODB_URI, JWT_SECRET_KEY, SECRET_KEY, etc.)
- `.env.example` and `backend/.env.example` - Template files with all required variables

**Deployment**:
- `Dockerfile.frontend` - Multi-stage build for Next.js frontend
- `Dockerfile.backend` - Multi-stage build for Flask backend
- `infrastructure/` - AWS CDK infrastructure as code for ECS Fargate
- `.github/workflows/*.yml` - CI/CD pipeline (build → ECR Public → ECS via CDK)

## Critical Patterns to Follow

### Adding a New API Endpoint

1. **Backend** (Flask):
   ```python
   # In backend/routes/<module>.py
   from flask import Blueprint
   from flask_restx import Resource, Namespace, fields
   from utils.auth import token_required

   api = Namespace('feature', description='Feature operations')

   @api.route('/path')
   class FeatureResource(Resource):
       @token_required
       @api.doc('get_feature')
       def get(self, current_user):
           # Implementation
           return {'data': result}, 200

   # Register in backend/app.py:
   from routes.feature import api as feature_ns
   api.add_namespace(feature_ns, path='/api/feature')
   ```

2. **Frontend** (API client):
   ```typescript
   // In lib/api.ts
   export async function getFeature() {
     const response = await apiClient.get('/feature/path');
     return response.data;
   }
   ```

3. **Frontend** (UI):
   ```typescript
   // In component
   import { getFeature } from '@/lib/api';

   const data = await getFeature();
   ```

### Authentication Requirements

- **Protected Backend Routes**: Use `@token_required` decorator (extracts user from JWT in `Authorization: Bearer <token>` header)
- **Protected Frontend Routes**: Add to `middleware.ts` matcher config
- **Admin-Only Routes**: Check `current_user['role'] == 'admin'` in backend
- **Session Access**: `const session = await auth()` in Server Components, `useSession()` in Client Components

### Database Operations

All database models follow this pattern:
```python
class Model:
    COLLECTION = 'collection_name'

    def __init__(self, db):
        self.db = db
        self.collection = db[self.COLLECTION]

    def create(self, data: dict) -> str:
        # Insert and return ID
        result = self.collection.insert_one(data)
        return str(result.inserted_id)

    def find_by_id(self, id: str) -> Optional[dict]:
        # Query by ObjectId
        return self.collection.find_one({'_id': ObjectId(id)})
```

Always use `ObjectId(id)` when querying by `_id` in MongoDB.

### Real-time Messaging

Messages flow through Socket.IO:
```python
# Backend emits to channel room
socketio.emit('new_message', message_data, room=channel_id)

# Frontend listens
socket.on('new_message', (data) => {
  // Update UI
});
```

Join/leave rooms when switching channels:
```javascript
socket.emit('join_channel', { channelId, userId });
socket.emit('leave_channel', { channelId, userId });
```

## Common Gotchas

1. **MongoDB URI**: Must include `?retryWrites=true&w=majority` for MongoDB Atlas connections
2. **CORS Origins**: Backend `CORS_ORIGINS` must match frontend URLs exactly (including ports)
3. **JWT Token**: Passed from Flask to NextAuth in `authorize()` callback, stored as `accessToken`, retrieved via `session.user.accessToken`
4. **Socket.IO CORS**: Set in Flask app creation: `cors_allowed_origins=app.config['CORS_ORIGINS']`
5. **Environment Variables**: Frontend needs `NEXT_PUBLIC_` prefix to expose to browser
6. **ObjectId Serialization**: Convert to string when returning from MongoDB: `str(result.inserted_id)`
7. **File Uploads**: Frontend sends to `/api/upload`, backend saves to `static/uploads/` or S3/Cloudinary
8. **Port Conflicts**: Frontend dev (3000), production (8080), Backend (5001)

## Deployment Pipeline

**GitHub Actions Workflow** (`.github/workflows/*.yml`):
1. Checkout code
2. Set up Docker Buildx
3. Authenticate to AWS via OIDC (no static keys)
4. Create ECR repositories if missing (private + public)
5. Build Docker image with Next.js standalone output
6. Push to both ECR Public (global distribution) and private ECR
7. Tag images: `latest`, `<git-sha>`, `<branch-name>`
8. Cache layers using GitHub Actions cache

**Image Structure** (Dockerfile):
- Stage 1: Install dependencies and build Next.js app
- Stage 2: Standalone deployment with only production dependencies
- Runs on port 8080 with `npm start`

## Documentation Files

The repository contains extensive documentation:
- `AUTHENTICATION_GUIDE.md` - JWT, Google OAuth, 2FA setup
- `BACKEND_API_REQUIREMENTS.md` - Complete API specification
- `DATABASE_AI_REQUIREMENTS_MONGODB.md` - Enhanced MongoDB schema with AI features
- `DEPLOYMENT_GUIDE.md` - Production deployment instructions
- `DEPLOYMENT_CHECKLIST.md` - Pre-deployment verification steps
- `EMAIL_VERIFICATION_GUIDE.md` - Email verification implementation
- `FRONTEND_DOCS.md` - Frontend architecture and components
- `GOOGLE_OAUTH_SETUP.md` - Google OAuth configuration
- `SLACK_COMPARISON.md` - Feature comparison with Slack
- `STATIC_DATA_LOCATIONS.md` - Hardcoded data locations for migration
- `TESTING_GUIDE.md` - Manual testing procedures
- `MONOREPO_README.md` - Monorepo overview
- `backend/README.md` - Backend setup guide
- `websocket-api/README.md` - WebSocket API deployment

When making changes that affect documented features, update the relevant documentation files.
