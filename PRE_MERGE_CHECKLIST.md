# Pre-Merge Checklist for AWS Lightsail Deployment

## ✅ Completed

- [x] Removed venv_old from repository (commit 3b9381a)
- [x] Fixed .gitignore malformed entry
- [x] Added CLAUDE.md for future development
- [x] Added backend/.env.example
- [x] Created single-container Dockerfile (Next.js + Flask)
- [x] Configured supervisord for process management
- [x] Updated .dockerignore for optimal builds
- [x] Created deployment documentation

## 🚀 Ready to Merge

### Current Branch Status
```
Branch: feat/frontend-react
Commits ahead of main: ~10
Last commit: 7b5a458 (single-container deployment)
```

### What This Deployment Includes

**Frontend (Next.js 15)**:
- React-based chat UI
- NextAuth authentication
- Google OAuth support
- Admin dashboard
- Profile management

**Backend (Flask)**:
- REST API endpoints
- MongoDB integration
- JWT authentication
- Socket.IO WebSocket support
- File upload handling
- 2FA support

**Both run in ONE Docker container via supervisord**

## ⚠️ Before You Merge - CRITICAL STEPS

### 1. Set GitHub Secrets (REQUIRED)

Go to GitHub → Settings → Secrets and variables → Actions → New repository secret

**Required Secrets**:
```bash
# Database (ABSOLUTELY REQUIRED)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/chatapp?retryWrites=true&w=majority

# Authentication Secrets (REQUIRED)
NEXTAUTH_SECRET=<run: openssl rand -base64 32>
JWT_SECRET_KEY=<run: python -c "import secrets; print(secrets.token_urlsafe(32))">
SECRET_KEY=<run: python -c "import secrets; print(secrets.token_urlsafe(32))">

# Your Lightsail URL (will be assigned after first deployment)
NEXTAUTH_URL=https://your-container.us-west-2.amazonaws.com

# CORS (same as NEXTAUTH_URL)
CORS_ORIGINS=https://your-container.us-west-2.amazonaws.com
```

**Optional Secrets** (for Google OAuth):
```bash
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

**Optional Secrets** (for email):
```bash
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
```

### 2. MongoDB Atlas Setup (REQUIRED)

1. Go to https://cloud.mongodb.com/
2. Create FREE M0 cluster
3. Database Access → Add user (username + password)
4. Network Access → Add IP: `0.0.0.0/0` (allow from anywhere)
5. Get connection string: Clusters → Connect → Connect your application
6. Format: `mongodb+srv://<user>:<pass>@cluster.mongodb.net/chatapp?retryWrites=true&w=majority`
7. Add to GitHub Secrets as `MONGODB_URI`

### 3. Update GitHub Actions Workflow (Optional - for env vars)

Your workflow at `.github/workflows/ecr-dual-publish.yml` should pass environment variables to the container. You may need to update the Lightsail deployment step to include:

```yaml
environment:
  MONGODB_URI: ${{ secrets.MONGODB_URI }}
  NEXTAUTH_SECRET: ${{ secrets.NEXTAUTH_SECRET }}
  JWT_SECRET_KEY: ${{ secrets.JWT_SECRET_KEY }}
  SECRET_KEY: ${{ secrets.SECRET_KEY }}
  CORS_ORIGINS: ${{ secrets.CORS_ORIGINS }}
  # ... etc
```

## 📋 Merge Steps

### Step 1: Final Review
```bash
# Review all changes one more time
git diff main --stat

# Check commit history
git log main..feat/frontend-react --oneline
```

### Step 2: Merge to Main
```bash
# Switch to main
git checkout main

# Pull latest
git pull origin main

# Merge the PR branch
git merge feat/frontend-react

# Push to trigger deployment
git push origin main
```

### Step 3: Monitor Deployment

1. **GitHub Actions**: Watch the workflow run at https://github.com/ConnectBest/chat/actions
2. **ECR**: Verify image is pushed to public ECR
3. **Lightsail**: Check container logs for any errors

### Step 4: Configure Lightsail Environment Variables

After first deployment, go to:
- AWS Console → Lightsail → Containers → chat-app
- Edit deployment → Environment variables
- Add all required environment variables (MONGODB_URI, secrets, etc.)
- Redeploy with new environment variables

### Step 5: Update NEXTAUTH_URL

After deployment, Lightsail assigns a URL like:
```
https://chat-app.service.us-west-2.amazonaws.com
```

Update GitHub Secrets:
```bash
NEXTAUTH_URL=https://chat-app.service.us-west-2.amazonaws.com
CORS_ORIGINS=https://chat-app.service.us-west-2.amazonaws.com
FRONTEND_URL=https://chat-app.service.us-west-2.amazonaws.com
BACKEND_URL=https://chat-app.service.us-west-2.amazonaws.com
```

Then redeploy to pick up the new values.

## 🧪 Post-Deployment Testing

### 1. Health Check
```bash
curl https://your-url.com/api/health
```

Should return:
```json
{"status": "healthy", "mongodb": "connected"}
```

### 2. Frontend Access
- Visit https://your-url.com
- Should see the chat landing page
- Try registering a new account

### 3. Backend API
```bash
curl https://your-url.com/api/auth/me
```

### 4. Check Logs
- Lightsail Console → Logs
- Look for both Next.js and Flask startup messages
- Verify no errors

## 🐛 If Something Goes Wrong

### Container won't start
1. Check Lightsail logs for errors
2. Verify MongoDB_URI is correct
3. Ensure all required env vars are set

### Frontend works but backend errors
1. Check CORS_ORIGINS matches your domain
2. Verify JWT_SECRET_KEY and SECRET_KEY are set
3. Check MongoDB connection from backend logs

### Can't login/register
1. Verify NEXTAUTH_SECRET is set
2. Check NEXTAUTH_URL matches your actual URL
3. Verify MongoDB is accessible

## 📊 What Gets Deployed

### Docker Image Contents
```
/app/
  frontend/          # Next.js standalone build
    server.js        # Next.js server (port 8080)
    .next/static/    # Static assets
  backend/           # Flask application
    app.py          # Flask server (port 5001)
    models/         # MongoDB models
    routes/         # API endpoints
    utils/          # Helper functions
```

### Processes Running
```
supervisord
  ├── nextjs (port 8080)  ← External traffic
  └── flask (port 5001)   ← Internal API
```

### Network Flow
```
Internet → Port 8080 (Next.js) → http://localhost:5001/api (Flask) → MongoDB
```

## 📝 Final Checklist

Before merging, confirm:

- [ ] MongoDB Atlas cluster is created and accessible
- [ ] MONGODB_URI is added to GitHub Secrets
- [ ] NEXTAUTH_SECRET, JWT_SECRET_KEY, SECRET_KEY are generated and added
- [ ] You understand you'll need to update NEXTAUTH_URL after first deployment
- [ ] You've read SINGLE_CONTAINER_DEPLOYMENT.md
- [ ] All commits are clean (no venv, no .pid files)

## 🎯 After Successful Deployment

1. Test all features (login, channels, messages)
2. Set up MongoDB backups (Atlas has automatic backups)
3. Monitor logs for any errors
4. Consider setting up custom domain (optional)
5. Enable HTTPS (Lightsail provides this automatically)

---

**You're ready to merge! 🚀**

The container will include both frontend and backend, making deployment simple for your academic project.
