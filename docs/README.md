# ConnectBest Chat Documentation

This directory contains all documentation for the ConnectBest Chat application, organized by topic and purpose.

## 📂 Documentation Structure

### 🚀 Setup & Getting Started
- **[backend-readme.md](setup/backend-readme.md)** - Complete backend setup guide with Flask, MongoDB, and testing
- **[backend-setup.md](setup/backend-setup.md)** - Backend getting started guide
- **[websocket-readme.md](setup/websocket-readme.md)** - WebSocket API deployment and configuration
- **[MONOREPO_README.md](setup/MONOREPO_README.md)** - Monorepo structure overview

### 🏗️ Architecture & Design
- **[FRONTEND_DOCS.md](architecture/FRONTEND_DOCS.md)** - Frontend architecture, components, and design patterns
- **[backend-architecture.md](architecture/backend-architecture.md)** - Backend architecture documentation
- **[DATABASE_AI_REQUIREMENTS_MONGODB.md](architecture/DATABASE_AI_REQUIREMENTS_MONGODB.md)** - MongoDB schema design for AI features
- **[DATABASE_AI_REQUIREMENTS.md](architecture/DATABASE_AI_REQUIREMENTS.md)** - AI-related database schema expectations

### 🔐 Authentication & Security
- **[AUTHENTICATION_GUIDE.md](authentication/AUTHENTICATION_GUIDE.md)** - JWT, session handling, Google OAuth, and 2FA
- **[GOOGLE_OAUTH_SETUP.md](authentication/GOOGLE_OAUTH_SETUP.md)** - Google OAuth credentials setup and integration
- **[EMAIL_VERIFICATION_GUIDE.md](authentication/EMAIL_VERIFICATION_GUIDE.md)** - Email verification workflow

### 🛠️ Development
- **[TESTING_GUIDE.md](development/TESTING_GUIDE.md)** - Manual testing flows and procedures
- **[STATIC_DATA_LOCATIONS.md](development/STATIC_DATA_LOCATIONS.md)** - Static/mock data locations that require backend integration
- **[LEARNING_GUIDE.md](development/LEARNING_GUIDE.md)** - Learning resources and development guidance
- **[SCHEMA_MIGRATION.md](development/SCHEMA_MIGRATION.md)** - Database schema migration procedures

### 🚀 Deployment
- **[DEPLOYMENT_GUIDE.md](deployment/DEPLOYMENT_GUIDE.md)** - Full production deployment instructions
- **[DEPLOYMENT_CHECKLIST.md](deployment/DEPLOYMENT_CHECKLIST.md)** - Deployment readiness checklist
- **[websocket-deployment.md](deployment/websocket-deployment.md)** - WebSocket API deployment guide

### 📡 API Documentation
- **[BACKEND_API_REQUIREMENTS.md](api/BACKEND_API_REQUIREMENTS.md)** - Required backend endpoints & API specifications
- **[API_REFERENCE.md](api/API_REFERENCE.md)** - Detailed API reference documentation

### 📊 Diagrams & Visuals
- **[erd.mmd](diagrams/erd.mmd)** - Entity Relationship Diagram (Mermaid)
- **[sequence-auth-msg-upload.mmd](diagrams/sequence-auth-msg-upload.mmd)** - Authentication, messaging, and upload flow diagram

## 🎯 Quick Start Paths

### For New Developers
1. Start with [MONOREPO_README.md](setup/MONOREPO_README.md) for project overview
2. Follow [backend-readme.md](setup/backend-readme.md) for complete backend setup
3. Review [AUTHENTICATION_GUIDE.md](authentication/AUTHENTICATION_GUIDE.md) for auth implementation

### For DevOps/Deployment
1. Check [DEPLOYMENT_CHECKLIST.md](deployment/DEPLOYMENT_CHECKLIST.md) for readiness
2. Follow [DEPLOYMENT_GUIDE.md](deployment/DEPLOYMENT_GUIDE.md) for production setup
3. Use [websocket-deployment.md](deployment/websocket-deployment.md) for WebSocket API

### For Frontend Developers
1. Read [FRONTEND_DOCS.md](architecture/FRONTEND_DOCS.md) for component architecture
2. Review [AUTHENTICATION_GUIDE.md](authentication/AUTHENTICATION_GUIDE.md) for auth integration
3. Check [TESTING_GUIDE.md](development/TESTING_GUIDE.md) for testing procedures

### For Backend Developers
1. Start with [backend-architecture.md](architecture/backend-architecture.md)
2. Follow [API_REFERENCE.md](api/API_REFERENCE.md) for endpoint details
3. Review [SCHEMA_MIGRATION.md](development/SCHEMA_MIGRATION.md) for database changes

## 🔄 Integration Points

- **Authentication**: NextAuth.js (frontend) ↔ JWT tokens (backend)
- **Real-time**: Socket.IO (Flask) + AWS WebSocket API (serverless)
- **Database**: MongoDB with enhanced schema for AI features
- **Deployment**: Docker containers → AWS ECS Fargate
- **CI/CD**: GitHub Actions + AWS CDK for infrastructure

## 📝 Contributing to Documentation

When adding or updating documentation:

1. **Placement**: Use the appropriate subdirectory based on content type
2. **Naming**: Use descriptive names with hyphens (kebab-case)
3. **Links**: Update this README.md index when adding new docs
4. **Format**: Use clear headings, code blocks, and examples
5. **Cross-references**: Link between related documents

## 🛠️ Development Notes

- All documentation is written in GitHub Flavored Markdown
- Mermaid diagrams are used for visual representations
- Code examples should be complete and runnable
- Environment-specific instructions are clearly marked
- Security considerations are highlighted where relevant