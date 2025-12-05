# Architecture & Design

Technical architecture documentation, database design, and system component specifications.

## 📖 Available Documentation

### Frontend Architecture
- **[FRONTEND_DOCS.md](FRONTEND_DOCS.md)** - React components, Next.js architecture, UI patterns, and design system

### Backend Architecture
- **[backend-architecture.md](backend-architecture.md)** - Flask application structure, API design, and service patterns

### Database Design
- **[DATABASE_AI_REQUIREMENTS_MONGODB.md](DATABASE_AI_REQUIREMENTS_MONGODB.md)** - MongoDB schema with AI features, collections, and relationships
- **[DATABASE_AI_REQUIREMENTS.md](DATABASE_AI_REQUIREMENTS.md)** - General AI-related database requirements and expectations

## 🏗️ Architecture Overview

The ConnectBest Chat application follows a modern full-stack architecture:

### Frontend (Next.js 15)
- **App Router** with server and client components
- **Authentication** via NextAuth.js with JWT integration
- **Real-time** messaging with Socket.IO client
- **UI Components** built with Tailwind CSS and custom design system

### Backend (Flask)
- **REST API** with Flask-RESTX and Swagger documentation
- **JWT Authentication** with bcrypt password hashing
- **MongoDB** for data persistence with enhanced schema
- **Real-time** messaging via Socket.IO server

### Infrastructure
- **AWS ECS Fargate** for containerized deployment
- **Application Load Balancer** with SSL termination
- **WebSocket API** using AWS API Gateway + Lambda + DynamoDB
- **CI/CD** pipeline with GitHub Actions and AWS CDK

## 🔄 Data Flow

1. **Authentication**: NextAuth.js ↔ Flask JWT tokens
2. **API Requests**: Next.js API routes → Flask backend
3. **Real-time**: Socket.IO (Flask) + AWS WebSocket API
4. **Database**: MongoDB collections with AI-ready schema
5. **Deployment**: Docker containers → AWS ECS via GitHub Actions