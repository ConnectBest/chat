# ✅ Deployment Checklist - ConnectBest Chat

Use this checklist to ensure all deployment requirements are met before going live.

## 🗄️ Database Setup

### MongoDB Atlas
- [ ] MongoDB Atlas account created
- [ ] Free M0 cluster created in preferred region
- [ ] Database user created with read/write permissions
- [ ] Network access configured (0.0.0.0/0 or specific Lightsail IP)
- [ ] Connection string tested and saved
- [ ] Connection string added to GitHub Secrets as `MONGODB_URI`

### Redis (Optional - for Production Scaling)
- [ ] Redis Cloud account created (or local Redis running)
- [ ] Connection string saved
- [ ] Connection string added to GitHub Secrets as `REDIS_URL`

## 🔐 Authentication & Secrets

### Required Secrets (GitHub Repository Settings → Secrets)
- [ ] `MONGODB_URI` - MongoDB connection string
- [ ] `NEXTAUTH_SECRET` - Generated with `openssl rand -base64 32`
- [ ] `NEXTAUTH_URL` - Will update after first deployment with Lightsail URL

### Optional Secrets (Recommended)
- [ ] `GOOGLE_CLIENT_ID` - From Google Cloud Console
- [ ] `GOOGLE_CLIENT_SECRET` - From Google Cloud Console
- [ ] `EMAIL_HOST` - SMTP server (e.g., smtp.gmail.com)
- [ ] `EMAIL_PORT` - SMTP port (usually 587)
- [ ] `EMAIL_USER` - Email account for sending
- [ ] `EMAIL_PASSWORD` - App password (NOT regular password)
- [ ] `EMAIL_FROM` - From address for emails

### AWS Secrets (Should Already Exist)
- [ ] `AWS_ROLE_ARN` - IAM role for GitHub Actions
- [ ] `AWS_REGION` - Set as repository variable (us-west-2)
- [ ] `AWS_ACCOUNT_ID` - Set as repository variable
- [ ] `ECR_PUBLIC_ALIAS` - Set as repository variable
- [ ] `ECR_PUBLIC_REPO` - Set as repository variable

## 🔑 Google OAuth Setup (Optional but Recommended)

- [ ] Google Cloud project created
- [ ] Google+ API enabled
- [ ] OAuth 2.0 credentials created
- [ ] Authorized redirect URIs configured:
  - [ ] http://localhost:3000/api/auth/callback/google (dev)
  - [ ] https://your-lightsail-url.com/api/auth/callback/google (prod)
- [ ] Client ID and Secret saved to GitHub Secrets

## 📧 Email Setup (Optional - for Email Verification)

### Gmail Option
- [ ] Gmail account with 2FA enabled
- [ ] App Password generated (NOT regular password)
- [ ] Test email sent successfully

### SendGrid/SES Option
- [ ] Service account created
- [ ] API key/credentials generated
- [ ] Sender email verified
- [ ] Test email sent successfully

## ☁️ AWS Lightsail Setup

- [ ] AWS account with appropriate permissions
- [ ] AWS CLI installed and configured
- [ ] Lightsail container service created (or will be created by workflow):
  ```bash
  aws lightsail create-container-service \
    --service-name chat-app \
    --power nano \
    --scale 1 \
    --region us-west-2
  ```
- [ ] Service power level selected:
  - [ ] Nano ($7/mo) - Testing/small teams
  - [ ] Micro ($10/mo) - **Recommended for production**
  - [ ] Small ($20/mo) - Growing usage
  - [ ] Medium ($40/mo) - High traffic

## 📦 Container Registry

- [ ] ECR public repository exists (or will be created by workflow)
- [ ] ECR private repository exists (or will be created by workflow)
- [ ] GitHub Actions has permissions to push to ECR

## 🚀 Pre-Deployment Verification

### Local Testing
- [ ] Application runs locally with `npm run dev`
- [ ] Docker build succeeds: `docker build -t chat:test .`
- [ ] Docker container runs: `docker run -p 8080:8080 chat:test`
- [ ] Health check responds: `curl http://localhost:8080/api/health`
- [ ] Login works with test account
- [ ] MongoDB connection successful (if configured)

### Code Quality
- [ ] No TypeScript errors: `npm run build`
- [ ] No linting errors: `npm run lint`
- [ ] All environment variables documented in `.env.example`

## 🎯 Initial Deployment

### Step 1: Prepare
- [ ] All secrets configured in GitHub
- [ ] MongoDB Atlas reachable from internet
- [ ] All pre-deployment checks passed

### Step 2: Deploy
- [ ] Push to `main` branch or trigger workflow manually
- [ ] Monitor GitHub Actions workflow
- [ ] Wait for build to complete (~5-10 minutes)
- [ ] Wait for deployment to complete (~2-5 minutes)

### Step 3: Get Deployment URL
```bash
aws lightsail get-container-services \
  --service-name chat-app \
  --region us-west-2 \
  --query 'containerServices[0].url' \
  --output text
```
- [ ] Deployment URL retrieved
- [ ] URL saved for next step

### Step 4: Update NEXTAUTH_URL
- [ ] Go to GitHub → Settings → Secrets
- [ ] Update `NEXTAUTH_URL` with Lightsail URL (must include https://)
- [ ] Re-trigger deployment to pick up new URL

## ✅ Post-Deployment Verification

### Health Checks
- [ ] Health endpoint responds: `https://your-url.com/api/health`
- [ ] Response shows `"status": "healthy"`
- [ ] MongoDB connection shows `"mongodb": "connected"`

### Authentication Tests
- [ ] Home page loads successfully
- [ ] Can navigate to `/login`
- [ ] Email/password login works (with test account)
- [ ] Google OAuth works (if configured)
- [ ] Registration works (if email configured)
- [ ] Can access `/chat/general` after login

### Feature Tests
- [ ] Can send messages in chat
- [ ] Can create new channel
- [ ] Can search for users
- [ ] Admin dashboard accessible (`/admin`) for admin users
- [ ] Ops dashboard accessible (`/ops`) for admin users
- [ ] Profile page works (`/profile`)

### Security Checks
- [ ] HTTPS is enabled (Lightsail provides this automatically)
- [ ] `/api/health` is accessible
- [ ] Protected routes require authentication
- [ ] Admin routes blocked for non-admin users

## 🔧 Optional Enhancements

### Custom Domain
- [ ] Domain registered
- [ ] DNS configured (CNAME or A record)
- [ ] SSL certificate configured
- [ ] `NEXTAUTH_URL` updated with custom domain
- [ ] Google OAuth redirect URI updated

### Monitoring
- [ ] CloudWatch Logs enabled
- [ ] CPU/Memory alarms configured
- [ ] Error tracking setup (e.g., Sentry)
- [ ] Uptime monitoring (e.g., UptimeRobot)

### Performance
- [ ] CloudFront CDN configured (optional)
- [ ] Redis caching enabled (optional)
- [ ] MongoDB indexes created
- [ ] Image optimization enabled

## 🎓 Team Onboarding

### Admin Setup
- [ ] First admin user created
- [ ] Test user accounts created
- [ ] Channels created for different teams
- [ ] User roles documented

### User Access
- [ ] Team members invited
- [ ] Login instructions shared
- [ ] Features demonstrated
- [ ] Support contact established

## 📊 Monitoring & Maintenance

### Regular Checks (Weekly)
- [ ] Check application health
- [ ] Monitor MongoDB storage usage
- [ ] Review error logs
- [ ] Check Lightsail metrics (CPU, memory)

### Monthly Maintenance
- [ ] Review user analytics
- [ ] Check for security updates
- [ ] Optimize database indexes
- [ ] Review costs and scaling needs

## 🚨 Emergency Contacts

- **MongoDB Support**: https://support.mongodb.com/
- **AWS Support**: https://console.aws.amazon.com/support/
- **GitHub Support**: https://support.github.com/

## 📚 Reference Links

- Deployment Guide: `DEPLOYMENT_GUIDE.md`
- Frontend Docs: `FRONTEND_DOCS.md`
- Backend API: `BACKEND_API_REQUIREMENTS.md`
- Database Schema: `DATABASE_AI_REQUIREMENTS_MONGODB.md`
- Authentication: `AUTHENTICATION_GUIDE.md`

---

## Quick Reference Commands

```bash
# Check deployment status
aws lightsail get-container-services \
  --service-name chat-app \
  --region us-west-2 \
  --query 'containerServices[0].state'

# View deployment URL
aws lightsail get-container-services \
  --service-name chat-app \
  --region us-west-2 \
  --query 'containerServices[0].url' \
  --output text

# View container logs
aws lightsail get-container-log \
  --service-name chat-app \
  --container-name chat \
  --region us-west-2

# Test health endpoint
curl https://your-lightsail-url.com/api/health

# Test MongoDB connection (from local)
mongosh "your-mongodb-uri"
```

---

**Date Completed**: _______________

**Deployed By**: _______________

**Deployment URL**: _______________

**Notes**:
_____________________________________________________________________
_____________________________________________________________________
_____________________________________________________________________
