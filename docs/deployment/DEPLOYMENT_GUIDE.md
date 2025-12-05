# 🚀 ConnectBest Chat - Complete Deployment Guide

## 📋 Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Database Setup](#database-setup)
- [Environment Configuration](#environment-configuration)
- [Local Development](#local-development)
- [Production Deployment](#production-deployment)
- [Post-Deployment](#post-deployment)
- [Troubleshooting](#troubleshooting)
- [Scaling & Optimization](#scaling--optimization)

---

## Overview

This application is a **full-stack team collaboration platform** built with:
- **Frontend**: Next.js 15 (React 18) with TypeScript
- **Backend**: Next.js API Routes (integrated)
- **Database**: MongoDB (primary) + Redis (optional, for caching)
- **Authentication**: NextAuth.js v5 (Google OAuth + Email/Password)
- **Deployment**: AWS Lightsail (containerized) via GitHub Actions
- **Container Registry**: AWS ECR (both public and private)

### Key Features
✅ Real-time messaging with WebSocket support
✅ Channel-based organization (public/private/DMs)
✅ Google OAuth & Email/Password authentication
✅ Admin dashboard for user management
✅ Ops dashboard for system monitoring
✅ File attachments & emoji reactions
✅ Message threading & search
✅ Mobile-responsive design

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         GitHub Actions                          │
│  (Build Docker Image → Push to ECR → Deploy to Lightsail)      │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │   AWS ECR (Private)  │
            │   Docker Registry    │
            └──────────┬───────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │   AWS Lightsail Container   │
         │   ┌─────────────────────┐   │
         │   │   Next.js App       │   │
         │   │   (Frontend + API)  │   │
         │   │   Port: 8080        │   │
         │   └─────────────────────┘   │
         └──────────┬──────────────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
         ▼                     ▼
   ┌──────────┐         ┌──────────┐
   │ MongoDB  │         │  Redis   │
   │  Atlas   │         │ (Optional)│
   └──────────┘         └──────────┘
```

---

## Prerequisites

### Required Tools
- ✅ Git
- ✅ Node.js 18+ & npm
- ✅ Docker (for local testing)
- ✅ AWS CLI (for deployment management)

### Required Accounts
- ✅ GitHub account (with repository access)
- ✅ MongoDB Atlas account (free M0 cluster available)
- ✅ AWS account (for Lightsail deployment)
- ✅ Google Cloud account (optional, for Google OAuth)
- ✅ Gmail account with App Password (optional, for email verification)

---

## Database Setup

### Option 1: MongoDB Atlas (Recommended for Production)

1. **Create Account & Cluster**
   ```bash
   # Go to: https://cloud.mongodb.com/
   # Sign up or log in
   # Create a new project: "ConnectBest"
   # Create a new cluster (M0 Free tier is sufficient to start)
   ```

2. **Configure Network Access**
   ```bash
   # In Atlas Dashboard → Network Access
   # Add IP Address:
   # - For Lightsail: 0.0.0.0/0 (allows all IPs)
   # - Or get your Lightsail static IP and whitelist it specifically
   ```

3. **Create Database User**
   ```bash
   # In Atlas Dashboard → Database Access
   # Add New Database User:
   #   - Username: chat-app-user
   #   - Password: <generate-strong-password>
   #   - Built-in Role: Read and write to any database
   ```

4. **Get Connection String**
   ```bash
   # In Atlas Dashboard → Databases → Connect
   # Choose: "Connect your application"
   # Copy connection string:
   mongodb+srv://chat-app-user:<password>@cluster0.xxxxx.mongodb.net/connectbest-chat?retryWrites=true&w=majority

   # Replace <password> with your actual password
   # Save this as MONGODB_URI secret in GitHub
   ```

5. **Initialize Collections (Optional)**
   ```bash
   # Collections will be created automatically on first use
   # Or manually create with MongoDB Compass:
   - users
   - channels
   - messages
   - channelMembers
   - messageReactions
   - attachments
   - sessions
   ```

### Option 2: Local MongoDB (Development Only)

```bash
# Using Docker
docker run -d -p 27017:27017 --name mongodb mongo:7

# Connection string
MONGODB_URI=mongodb://localhost:27017/connectbest-chat
```

### Redis Setup (Optional - for Production Scaling)

**For caching and real-time features (Phase 2)**

1. **Redis Cloud (Recommended)**
   ```bash
   # Go to: https://redis.com/try-free/
   # Create free account (30MB free tier)
   # Get connection string:
   REDIS_URL=redis://default:<password>@redis-xxxxx.cloud.redislabs.com:12345
   ```

2. **Local Redis (Development)**
   ```bash
   docker run -d -p 6379:6379 --name redis redis:7-alpine
   REDIS_URL=redis://localhost:6379
   ```

---

## Environment Configuration

### Required GitHub Secrets

Add these secrets in: `GitHub Repository → Settings → Secrets and variables → Actions → New repository secret`

| Secret Name | Description | Example | Required? |
|-------------|-------------|---------|-----------|
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/db` | ✅ YES |
| `NEXTAUTH_SECRET` | Secret for JWT encryption | Generate with: `openssl rand -base64 32` | ✅ YES |
| `NEXTAUTH_URL` | Production URL | `https://your-lightsail-url.com` | ✅ YES |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `xxxxx.apps.googleusercontent.com` | ⚠️  Optional* |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | `GOCSPX-xxxxx` | ⚠️  Optional* |
| `EMAIL_HOST` | SMTP server | `smtp.gmail.com` | ⚠️  Optional** |
| `EMAIL_PORT` | SMTP port | `587` | ⚠️  Optional** |
| `EMAIL_USER` | Email account | `noreply@yourdomain.com` | ⚠️  Optional** |
| `EMAIL_PASSWORD` | Email password/app password | `app-specific-password` | ⚠️  Optional** |
| `EMAIL_FROM` | From address | `ConnectBest <noreply@connectbest.com>` | ⚠️  Optional** |
| `AWS_ROLE_ARN` | AWS OIDC role (CI/CD) | `arn:aws:iam::xxx:role/GitHubActions` | ✅ Already set |

\* Google OAuth is optional but recommended for better UX
\** Email is optional but required for email/password registration with verification

### Generate NEXTAUTH_SECRET

```bash
# On Linux/Mac:
openssl rand -base64 32

# On Windows (PowerShell):
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# Example output:
# dGhpcyBpcyBhIHNlY3JldCBrZXkgZm9yIHByb2R1Y3Rpb24=
```

### Google OAuth Setup (Optional)

1. **Create OAuth Credentials**
   ```
   1. Go to: https://console.cloud.google.com/apis/credentials
   2. Create Project: "ConnectBest Chat"
   3. Enable Google+ API
   4. Create Credentials → OAuth 2.0 Client ID
   5. Application type: Web application
   6. Name: ConnectBest Chat Production
   ```

2. **Configure Authorized Redirect URIs**
   ```
   Add both:
   - http://localhost:3000/api/auth/callback/google (development)
   - https://your-lightsail-domain.com/api/auth/callback/google (production)
   ```

3. **Copy Credentials**
   ```
   Client ID: xxxxx-xxxxxx.apps.googleusercontent.com
   Client Secret: GOCSPX-xxxxxxxxxxxxxx

   → Add these to GitHub Secrets
   ```

### Email Setup (Optional - for Email Verification)

**Using Gmail:**

1. **Enable 2-Factor Authentication**
   ```
   Google Account → Security → 2-Step Verification → Turn On
   ```

2. **Create App Password**
   ```
   Google Account → Security → App Passwords
   → Generate new app password for "Mail"
   → Use this as EMAIL_PASSWORD (NOT your regular Gmail password)
   ```

3. **Add to GitHub Secrets**
   ```
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=<16-char-app-password>
   EMAIL_FROM=ConnectBest <noreply@connectbest.com>
   ```

**Using SendGrid/AWS SES (Alternative):**
```bash
# SendGrid
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=<your-sendgrid-api-key>

# AWS SES
EMAIL_HOST=email-smtp.us-west-2.amazonaws.com
EMAIL_PORT=587
EMAIL_USER=<AWS-SES-SMTP-USERNAME>
EMAIL_PASSWORD=<AWS-SES-SMTP-PASSWORD>
```

---

## Local Development

### 1. Clone Repository
```bash
git clone https://github.com/ConnectBest/chat.git
cd chat
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
```bash
# Copy example file
cp .env.example .env.local

# Edit .env.local with your local settings
nano .env.local
```

Minimum configuration for local development:
```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=local-dev-secret-change-me-in-production
NODE_ENV=development

# Optional: Add MongoDB if you want to test with real database
# MONGODB_URI=mongodb://localhost:27017/connectbest-chat

# Optional: Google OAuth (recommended)
# GOOGLE_CLIENT_ID=your-client-id
# GOOGLE_CLIENT_SECRET=your-client-secret
```

### 4. Run Development Server
```bash
npm run dev

# Application runs on: http://localhost:3000
```

### 5. Test with Pre-configured Accounts

**Admin Account:**
```
Email: demo@test.com
Password: demo123
Access: Full (Admin + Ops Dashboards)
```

**User Accounts:**
```
Email: alice@test.com
Password: alice123

Email: bob@test.com
Password: bob123
```

### 6. Test Docker Build (Optional)
```bash
# Build image
docker build -t connectbest-chat:local .

# Run container
docker run -p 8080:8080 \
  -e NEXTAUTH_SECRET=test-secret \
  -e NEXTAUTH_URL=http://localhost:8080 \
  -e NODE_ENV=development \
  connectbest-chat:local

# Access: http://localhost:8080
```

---

## Production Deployment

### Pre-Deployment Checklist

- [x] MongoDB Atlas cluster created and configured
- [x] Database user created with proper permissions
- [x] Network access configured (0.0.0.0/0 or specific IPs)
- [x] Connection string tested locally
- [x] All GitHub Secrets configured (see table above)
- [x] Google OAuth credentials configured (if using)
- [x] Email SMTP configured (if using)
- [x] AWS Lightsail service exists (or will be created by workflow)

### Deployment Methods

#### Method 1: Automatic Deployment (Recommended)

**Trigger:** Push to `main` branch

```bash
# Make changes
git add .
git commit -m "feat: your changes"
git push origin main

# GitHub Actions will automatically:
# 1. Build Docker image
# 2. Push to ECR (public + private)
# 3. Deploy to Lightsail
# 4. Run health checks
```

**Monitor deployment:**
```bash
# View in GitHub
# → Actions tab → Latest workflow run

# Check deployment status
aws lightsail get-container-services \
  --service-name chat-app \
  --region us-west-2 \
  --query 'containerServices[0].state'
```

#### Method 2: Manual Deployment

```bash
# Trigger workflow manually
# GitHub → Actions → "Build, Push & Deploy" → Run workflow
```

### Initial Lightsail Setup (One-Time)

If Lightsail service doesn't exist yet:

```bash
# Create Lightsail container service
aws lightsail create-container-service \
  --service-name chat-app \
  --power nano \
  --scale 1 \
  --region us-west-2

# Enable container service
aws lightsail update-container-service \
  --service-name chat-app \
  --is-disabled false \
  --region us-west-2
```

**Service Sizing:**
- **Nano** (512 MB RAM, 0.25 vCPU): $7/month - Good for testing/small teams
- **Micro** (1 GB RAM, 0.5 vCPU): $10/month - Recommended for production start
- **Small** (2 GB RAM, 1 vCPU): $20/month - For growing usage
- **Medium** (4 GB RAM, 2 vCPU): $40/month - For high traffic

### Get Deployment URL

```bash
# After first deployment
aws lightsail get-container-services \
  --service-name chat-app \
  --region us-west-2 \
  --query 'containerServices[0].url' \
  --output text

# Example output:
# https://chat-app.xxxxxxxxx.us-west-2.cs.amazonlightsail.com
```

**Update NEXTAUTH_URL Secret:**
```bash
# GitHub → Settings → Secrets → Update NEXTAUTH_URL
# Set to your Lightsail URL (from above)
```

### Custom Domain (Optional)

1. **Get Static IP** (optional, for better DNS control)
   ```bash
   aws lightsail allocate-static-ip \
     --static-ip-name chat-app-ip \
     --region us-west-2
   ```

2. **Configure Domain**
   ```
   # In your DNS provider (e.g., Route 53, Cloudflare):
   # Add CNAME record:
   chat.yourdomain.com → <lightsail-url>

   # Or A record (if using static IP):
   chat.yourdomain.com → <static-ip>
   ```

3. **Enable HTTPS**
   ```bash
   # Lightsail automatically provides HTTPS
   # Update NEXTAUTH_URL to use https://chat.yourdomain.com
   ```

---

## Post-Deployment

### 1. Verify Health Check

```bash
# Check health endpoint
curl https://your-lightsail-url.com/api/health

# Expected response:
{
  "status": "healthy",
  "uptime": 99.99,
  "version": "1.0.0",
  "services": {
    "mongodb": "connected",
    "api": "operational"
  }
}
```

### 2. Test Authentication

1. **Visit your deployment URL**
   ```
   https://your-lightsail-url.com
   ```

2. **Create an account**
   - Use email/password registration
   - Check email for verification code (if configured)
   - Or use Google OAuth (if configured)

3. **Test admin access**
   - Login as `demo@test.com` / `demo123`
   - Visit `/admin` → Should see user management
   - Visit `/ops` → Should see system metrics

### 3. Monitor Logs

```bash
# View Lightsail logs
aws lightsail get-container-log \
  --service-name chat-app \
  --container-name chat \
  --region us-west-2

# Stream logs (requires additional setup)
# Recommended: Set up CloudWatch Logs integration
```

### 4. Create Your First Admin User

**Option 1: Directly in MongoDB**
```javascript
// Connect to MongoDB Atlas
// Find user by email
db.users.updateOne(
  { email: "your-email@example.com" },
  { $set: { role: "admin" } }
);
```

**Option 2: Via Mock Registration**
```
# Register normally, then update role in database
# Or use the pre-configured demo@test.com account
```

---

## Troubleshooting

### Common Issues

#### 1. **Deployment Fails - "Container service not found"**

**Solution:**
```bash
# Create the service first
aws lightsail create-container-service \
  --service-name chat-app \
  --power nano \
  --scale 1 \
  --region us-west-2
```

#### 2. **Health Check Failing**

**Symptoms:** Lightsail shows "Unhealthy"

**Diagnosis:**
```bash
# Check container logs
aws lightsail get-container-log \
  --service-name chat-app \
  --container-name chat \
  --region us-west-2 \
  | grep -i error

# Test health endpoint manually
curl https://your-url.com/api/health
```

**Common Causes:**
- MongoDB connection failing (check MONGODB_URI)
- Missing NEXTAUTH_SECRET
- Port mismatch (ensure 8080)
- Container not starting (check logs)

#### 3. **"Authentication Error" on Login**

**Solution:**
```bash
# Verify environment variables are set
aws lightsail get-container-services \
  --service-name chat-app \
  --region us-west-2 \
  --query 'containerServices[0].currentDeployment.containers.chat.environment'

# Ensure these are set:
# - NEXTAUTH_SECRET
# - NEXTAUTH_URL
# - MONGODB_URI
```

#### 4. **Google OAuth Not Working**

**Solution:**
1. Check authorized redirect URIs in Google Console include:
   ```
   https://your-lightsail-url.com/api/auth/callback/google
   ```
2. Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
3. Check browser console for errors

#### 5. **MongoDB Connection Errors**

**Symptoms:** 500 errors, "Cannot connect to MongoDB"

**Solutions:**
```bash
# 1. Check MongoDB Atlas network access
#    → Should include 0.0.0.0/0 or Lightsail IP

# 2. Verify connection string format
#    mongodb+srv://username:password@cluster.mongodb.net/database

# 3. Test connection locally
mongo "mongodb+srv://..." --username <user>

# 4. Check MongoDB Atlas status
#    https://status.mongodb.com/
```

#### 6. **Email Verification Not Working**

**Development Mode:**
- Verification codes are logged to console (check logs)
- Set `NODE_ENV=production` to send actual emails

**Production Mode:**
- Verify EMAIL_* variables are set correctly
- Test SMTP connection:
  ```bash
  telnet smtp.gmail.com 587
  # Should connect successfully
  ```
- Check Gmail "Less secure app access" (if using Gmail directly)
- Ensure App Password is used (not regular password)

---

## Scaling & Optimization

### Performance Optimization

#### 1. **Upgrade Lightsail Service**
```bash
# Upgrade to Micro (1 GB RAM)
aws lightsail update-container-service \
  --service-name chat-app \
  --power micro \
  --region us-west-2

# Scale horizontally (multiple containers)
aws lightsail update-container-service \
  --service-name chat-app \
  --scale 2 \
  --region us-west-2
```

#### 2. **Enable Redis Caching**
```bash
# Add Redis Cloud connection string
# Update GitHub Secret: REDIS_URL

# Benefits:
# - Faster user profile lookups
# - Reduced MongoDB load
# - Better real-time performance
```

#### 3. **MongoDB Optimization**
```javascript
// In MongoDB Atlas:
// 1. Enable Performance Advisor
// 2. Create recommended indexes
// 3. Upgrade to M10 for better performance

// Recommended indexes (see DATABASE_AI_REQUIREMENTS_MONGODB.md):
db.messages.createIndex({ channelId: 1, createdAt: -1 });
db.users.createIndex({ email: 1 }, { unique: true });
db.channelMembers.createIndex({ channelId: 1, userId: 1 }, { unique: true });
```

#### 4. **Enable CDN (CloudFront)**
```bash
# For static assets and images
# Setup AWS CloudFront distribution
# Point origin to Lightsail URL
# Benefits:
# - Faster global access
# - Reduced Lightsail load
# - Lower bandwidth costs
```

### Monitoring Setup

#### 1. **CloudWatch Integration**
```bash
# Enable CloudWatch Logs
aws lightsail update-container-service \
  --service-name chat-app \
  --region us-west-2 \
  --logs-enabled true
```

#### 2. **Set Up Alarms**
```bash
# CPU Utilization alarm
aws lightsail put-alarm \
  --alarm-name chat-app-high-cpu \
  --monitored-resource-name chat-app \
  --metric-name CPUUtilization \
  --comparison-operator GreaterThanThreshold \
  --threshold 80 \
  --evaluation-periods 2
```

#### 3. **Application Monitoring**
```bash
# Add Sentry for error tracking
# In .env or GitHub Secrets:
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx

# Benefits:
# - Real-time error alerts
# - Stack traces
# - Performance monitoring
```

### Cost Optimization

**Current Costs (Estimated):**
```
Lightsail Nano:    $7/month
MongoDB Atlas M0:  FREE
ECR Storage:       ~$0.10/month (1GB)
Data Transfer:     Included (up to 1TB)
──────────────────────────────
Total:             ~$7.10/month
```

**Scaling Costs:**
```
Lightsail Micro:   $10/month (recommended for production)
Lightsail Small:   $20/month (100+ users)
MongoDB M10:       $57/month (replica set, better performance)
Redis Cloud:       $5-10/month (caching)
CloudFront:        Pay-as-you-go (~$1-5/month for small sites)
```

---

## Additional Resources

### Documentation References
- **Frontend**: `FRONTEND_DOCS.md`
- **Backend API**: `BACKEND_API_REQUIREMENTS.md`
- **Authentication**: `AUTHENTICATION_GUIDE.md`
- **Database Schema**: `DATABASE_AI_REQUIREMENTS_MONGODB.md`
- **Google OAuth**: `GOOGLE_OAUTH_SETUP.md`
- **Testing**: `TESTING_GUIDE.md`

### Useful Commands

```bash
# View all Lightsail services
aws lightsail get-container-services --region us-west-2

# Get service details
aws lightsail get-container-service \
  --service-name chat-app \
  --region us-west-2

# View recent deployments
aws lightsail get-container-service-deployments \
  --service-name chat-app \
  --region us-west-2

# Force new deployment (without code changes)
# → GitHub Actions → Run workflow manually

# Delete service (CAREFUL!)
aws lightsail delete-container-service \
  --service-name chat-app \
  --region us-west-2
```

### Support

For issues or questions:
1. Check this guide first
2. Review GitHub Actions logs
3. Check AWS Lightsail console
4. Review MongoDB Atlas logs
5. Contact your team lead

---

**Last Updated:** December 1, 2025
**Version:** 1.0.0
**Status:** ✅ Production Ready
