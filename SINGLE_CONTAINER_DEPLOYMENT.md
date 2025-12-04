# Single Container Deployment Guide

## Architecture

This deployment runs **both** Next.js frontend and Flask backend in a **single Docker container** using `supervisord` as a process manager.

### Container Structure

```
┌─────────────────────────────────────┐
│   Docker Container (Port 8080)      │
│                                     │
│  ┌──────────────────────────────┐  │
│  │      Supervisord             │  │
│  │  (Process Manager)           │  │
│  └────────┬────────────┬────────┘  │
│           │            │            │
│  ┌────────▼─────┐  ┌──▼─────────┐  │
│  │  Next.js     │  │  Flask     │  │
│  │  Frontend    │  │  Backend   │  │
│  │  Port: 8080  │  │  Port:5001 │  │
│  └──────────────┘  └────────────┘  │
│                                     │
│  MongoDB Connection (External)      │
└─────────────────────────────────────┘
```

### How It Works

1. **Supervisord** starts both services simultaneously
2. **Next.js** runs on port 8080 (main entry point)
3. **Flask** runs on port 5001 (internal API)
4. Frontend makes API calls to `http://localhost:5001/api`
5. External traffic only hits port 8080

## Environment Variables Required

### For Next.js (Frontend)
```bash
# Set during docker build (build args)
NEXT_PUBLIC_API_URL=http://localhost:5001/api
NEXT_PUBLIC_WS_URL=http://localhost:5001
NEXT_PUBLIC_WEBSOCKET_URL=wss://your-websocket-url (optional)

# Set at runtime
NEXTAUTH_URL=https://your-lightsail-domain.com
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>
GOOGLE_CLIENT_ID=<your-google-client-id> (optional)
GOOGLE_CLIENT_SECRET=<your-google-client-secret> (optional)
```

### For Flask (Backend)
```bash
# Database (REQUIRED)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/chatapp?retryWrites=true&w=majority

# Security (REQUIRED)
JWT_SECRET_KEY=<generate-strong-random-key>
SECRET_KEY=<generate-strong-random-key>

# Flask Config
FLASK_ENV=production
DEBUG=False

# CORS (REQUIRED - must include your Lightsail domain)
CORS_ORIGINS=https://your-lightsail-domain.com

# URLs
FRONTEND_URL=https://your-lightsail-domain.com
BACKEND_URL=https://your-lightsail-domain.com

# Optional
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=<your-email>
MAIL_PASSWORD=<app-password>
```

## GitHub Actions Workflow

Your existing workflow (`.github/workflows/ecr-dual-publish.yml`) will:
1. Build the Docker image with both frontend + backend
2. Push to AWS ECR Public
3. Deploy to Lightsail automatically

### Build Args in Workflow

Make sure these are set in your GitHub Actions:

```yaml
- name: Build & Push to both registries
  uses: docker/build-push-action@v6
  with:
    build-args: |
      CACHEBUST=${{ github.run_number }}
      NEXT_PUBLIC_WEBSOCKET_URL=${{ secrets.WEBSOCKET_URL }}
      NEXT_PUBLIC_API_URL=http://localhost:5001/api
      NEXT_PUBLIC_WS_URL=http://localhost:5001
```

## AWS Lightsail Configuration

### Container Settings

```json
{
  "serviceName": "chat-app",
  "power": "micro",
  "scale": 1,
  "publicEndpoint": {
    "containerName": "chat",
    "containerPort": 8080,
    "healthCheck": {
      "path": "/api/health",
      "intervalSeconds": 30
    }
  }
}
```

### Environment Variables in Lightsail

Add these in Lightsail Console → Containers → chat-app → Custom domains → Environment variables:

```bash
# MongoDB (REQUIRED)
MONGODB_URI=mongodb+srv://...

# Auth (REQUIRED)
NEXTAUTH_URL=https://your-lightsail-url.com
NEXTAUTH_SECRET=your-secret-here
JWT_SECRET_KEY=your-jwt-secret
SECRET_KEY=your-flask-secret

# CORS (REQUIRED)
CORS_ORIGINS=https://your-lightsail-url.com

# URLs
FRONTEND_URL=https://your-lightsail-url.com
BACKEND_URL=https://your-lightsail-url.com

# Optional
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

## Local Testing

Test the combined container locally:

```bash
# Build the image
docker build -t chat-app:test .

# Run with environment variables
docker run -p 8080:8080 \
  -e MONGODB_URI=mongodb://localhost:27017/chatapp \
  -e NEXTAUTH_URL=http://localhost:8080 \
  -e NEXTAUTH_SECRET=test-secret \
  -e JWT_SECRET_KEY=test-jwt-secret \
  -e SECRET_KEY=test-flask-secret \
  -e CORS_ORIGINS=http://localhost:8080 \
  -e FRONTEND_URL=http://localhost:8080 \
  -e BACKEND_URL=http://localhost:8080 \
  chat-app:test

# Access at http://localhost:8080
```

## Health Checks

Both services have health check endpoints:

- **Frontend**: `http://localhost:8080/` (Next.js homepage)
- **Backend**: `http://localhost:8080/api/health` (Flask health endpoint)

Lightsail should use `/api/health` for health checks.

## Logs

View logs from both services:

```bash
# In Lightsail Console
Containers → chat-app → Metrics → View logs

# Locally
docker logs <container-id>
```

Logs are streamed to stdout/stderr and will show both Next.js and Flask output.

## Pros and Cons

### ✅ Pros
- **Simple deployment** - one container, one service
- **Lower cost** - single Lightsail instance
- **No network latency** - frontend/backend on same host
- **Easier environment management** - one place for all env vars

### ⚠️ Cons
- **Can't scale independently** - both services scale together
- **Shared resources** - CPU/memory split between services
- **Single point of failure** - if one service crashes, need to restart container
- **Larger image size** - includes both Node.js and Python

### When to Switch to Multi-Container

Consider splitting into separate services when:
- Need to scale frontend/backend independently
- Backend becomes CPU/memory intensive
- Want zero-downtime deployments
- Moving to production with high traffic

For an academic project, **single container is perfect!**

## Troubleshooting

### Container keeps restarting
- Check logs for errors from either Next.js or Flask
- Verify MongoDB connection string is correct
- Ensure all required env vars are set

### Backend not accessible
- Verify Flask is running on port 5001 internally
- Check supervisord logs: `docker exec <container> supervisorctl status`

### Frontend can't reach backend
- Verify `NEXT_PUBLIC_API_URL=http://localhost:5001/api`
- Check CORS_ORIGINS includes your domain
- Ensure both processes are running

## Next Steps

1. **Commit the changes** (Dockerfile, supervisord.conf, .dockerignore)
2. **Push to GitHub** - CI/CD will build the combined image
3. **Configure Lightsail** environment variables
4. **Test deployment** and monitor logs
5. **Verify** both frontend and backend are working
