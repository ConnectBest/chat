# Setup & Getting Started

Complete guides for setting up and configuring the ConnectBest Chat application.

## 📖 Available Guides

### Backend Setup
- **[backend-readme.md](backend-readme.md)** - Complete backend setup with Flask, MongoDB, dependencies, and testing
- **[backend-setup.md](backend-setup.md)** - Quick backend getting started guide

### Infrastructure Setup
- **[websocket-readme.md](websocket-readme.md)** - AWS WebSocket API deployment and configuration using SAM CLI

### Project Overview
- **[MONOREPO_README.md](MONOREPO_README.md)** - Monorepo structure and development workflow overview

## 🚀 Recommended Setup Order

### For New Developers
1. **[MONOREPO_README.md](MONOREPO_README.md)** - Start here for project overview
2. **[backend-readme.md](backend-readme.md)** - Set up the backend environment
3. **[../authentication/AUTHENTICATION_GUIDE.md](../authentication/AUTHENTICATION_GUIDE.md)** - Configure authentication

### For DevOps/Infrastructure
1. **[backend-readme.md](backend-readme.md)** - Understand backend requirements
2. **[websocket-readme.md](websocket-readme.md)** - Deploy WebSocket infrastructure
3. **[../deployment/DEPLOYMENT_GUIDE.md](../deployment/DEPLOYMENT_GUIDE.md)** - Production deployment

## 💡 Quick Start Tips

- **MongoDB**: Use MongoDB Atlas for cloud hosting or local installation
- **Environment Variables**: Copy and configure `.env` files before running
- **Dependencies**: Always use virtual environments for Python backend
- **Testing**: Use Swagger UI at `http://localhost:5000/docs` for API testing