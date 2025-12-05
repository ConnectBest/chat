# Production Deployment Guide - ConnectBest Chat Application

## 📋 Overview
This document provides a complete checklist for deploying the ConnectBest Chat application to production. The application uses Flask backend with Google OAuth authentication and Next.js frontend.

---

## 🔐 Required Configuration Changes

### 1. Google OAuth Configuration

#### A. Create Production OAuth Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new OAuth 2.0 Client ID for production
3. Configure the following settings:

**Authorized JavaScript Origins:**
```
https://yourdomain.com
https://www.yourdomain.com
```

**Authorized Redirect URIs:**
```
https://yourdomain.com/api/auth/google/callback
https://www.yourdomain.com/api/auth/google/callback
```

#### B. Update Environment Variables
Replace the development credentials with production credentials in `backend/.env`:
```bash
GOOGLE_CLIENT_ID=your-production-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-production-client-secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/google/callback
```

---

### 2. MongoDB Configuration

#### A. Create Production Database
1. Use **MongoDB Atlas** or your own MongoDB instance
2. Create a new database cluster for production
3. Configure IP whitelist to allow your production server IPs
4. Create a dedicated database user with limited permissions

#### B. Update Connection String
Update `backend/.env`:
```bash
# MongoDB Atlas Production Connection
MONGODB_URI=mongodb+srv://production-user:PASSWORD@cluster0.xxxxx.mongodb.net/chatapp_production?retryWrites=true&w=majority
MONGODB_DB_NAME=chatapp_production
```

**Important Notes:**
- Use a strong password with special characters
- If password contains `@`, encode it as `%40` in the connection string
- Use a separate database name for production (e.g., `chatapp_production`)
- Ensure MongoDB version is 4.4 or higher for optimal compatibility

---

### 3. Security Keys & Secrets

#### A. Generate New Production Keys
**CRITICAL:** Never use development keys in production!

Generate new keys using:
```bash
# Generate Flask SECRET_KEY
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(64))"

# Generate JWT_SECRET_KEY
python -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_urlsafe(64))"

# Generate NEXTAUTH_SECRET (for frontend)
node -e "console.log('NEXTAUTH_SECRET=' + require('crypto').randomBytes(64).toString('base64'))"
```

#### B. Update Backend Environment (`backend/.env`)
```bash
# Security Keys - GENERATE NEW ONES FOR PRODUCTION
SECRET_KEY=YOUR_NEW_64_CHAR_SECRET_KEY
JWT_SECRET_KEY=YOUR_NEW_64_CHAR_JWT_SECRET
JWT_EXPIRATION_HOURS=168  # 7 days - adjust as needed
```

#### C. Update Frontend Environment (`.env.local`)
```bash
# Frontend Configuration
NEXTAUTH_SECRET=YOUR_NEW_NEXTAUTH_SECRET

# Production API URLs
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
NEXT_PUBLIC_WS_URL=https://yourdomain.com
```

---

### 4. CORS Configuration

Update `backend/.env` with production domains:
```bash
# CORS Configuration - Add all production domains
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com,https://api.yourdomain.com
```

**Remove all localhost entries from production!**

---

### 5. Frontend URL Configuration

Update `backend/.env`:
```bash
# Frontend URL - Used for OAuth redirects
FRONTEND_URL=https://yourdomain.com
```

This is critical for OAuth callback redirects to work correctly.

---

### 6. Flask Environment Settings

Update `backend/.env`:
```bash
# Flask Environment - SET TO PRODUCTION
FLASK_ENV=production
DEBUG=False  # MUST be False in production

# Server Configuration
PORT=5001
HOST=0.0.0.0
```

**CRITICAL:** Never run with `DEBUG=True` in production!

---

## 🚀 Deployment Checklist

### Pre-Deployment Verification

- [ ] **Python Version**: Ensure Python 3.10+ is installed on production server
  - Python 3.11.7 or higher recommended for better SSL/TLS support
  - Check: `python --version`

- [ ] **Node.js Version**: Ensure Node.js 18+ is installed
  - Check: `node --version`

- [ ] **Environment Files**:
  - [ ] `backend/.env` configured with production values
  - [ ] `.env.local` configured with production values
  - [ ] All development values removed
  - [ ] All secrets regenerated

- [ ] **Google OAuth**:
  - [ ] Production OAuth credentials created
  - [ ] Redirect URIs configured correctly
  - [ ] OAuth consent screen configured
  - [ ] Credentials updated in `backend/.env`

- [ ] **MongoDB**:
  - [ ] Production database created
  - [ ] IP whitelist configured
  - [ ] Connection string tested
  - [ ] Database user has appropriate permissions

- [ ] **Security**:
  - [ ] All secrets regenerated (not using development secrets)
  - [ ] `DEBUG=False` in backend
  - [ ] CORS configured with production domains only
  - [ ] JWT expiration time reviewed

---

## 🏗️ Backend Deployment Steps

### 1. Install Python Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Set Python Version (if using pyenv)
```bash
pyenv local 3.11.7
```

### 3. Run Production Server
**Option A: Using Gunicorn (Recommended)**
```bash
gunicorn -w 4 -b 0.0.0.0:5001 --worker-class eventlet -w 1 app:app
```

**Option B: Using Docker**
```bash
docker build -f Dockerfile.backend -t connectbest-backend .
docker run -d -p 5001:5001 --env-file .env connectbest-backend
```

### 4. Configure Reverse Proxy (Nginx Example)
```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /api/ {
        proxy_pass http://localhost:5001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://localhost:5001/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

---

## 🎨 Frontend Deployment Steps

### 1. Build Production Frontend
```bash
cd /path/to/chat
npm run build
```

### 2. Deploy Options

**Option A: Using PM2**
```bash
npm install -g pm2
pm2 start npm --name "connectbest-frontend" -- start
pm2 save
pm2 startup
```

**Option B: Using Docker**
```bash
docker build -f Dockerfile.frontend -t connectbest-frontend .
docker run -d -p 3000:3000 --env-file .env.local connectbest-frontend
```

**Option C: Deploy to Vercel**
```bash
vercel --prod
```

### 3. Configure Nginx for Frontend (if needed)
```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🔒 SSL/HTTPS Configuration

### Required for Production

1. **Obtain SSL Certificate**:
   - Use Let's Encrypt (free): `certbot --nginx -d yourdomain.com`
   - Or use a commercial certificate provider

2. **Update All URLs to HTTPS**:
   - Backend `.env`: All URLs should start with `https://`
   - Frontend `.env.local`: All URLs should start with `https://`
   - Google OAuth: Redirect URIs must use `https://`

3. **Force HTTPS Redirect** (Nginx example):
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

---

## 📊 Environment Variables Summary

### Backend (`backend/.env`)
```bash
# Flask Environment
FLASK_ENV=production
DEBUG=False

# Security Keys (REGENERATE THESE!)
SECRET_KEY=<64-char-secret>
JWT_SECRET_KEY=<64-char-secret>
JWT_EXPIRATION_HOURS=168

# MongoDB Production
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/chatapp_production
MONGODB_DB_NAME=chatapp_production

# CORS (Production domains only!)
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Google OAuth (Production credentials!)
GOOGLE_CLIENT_ID=<production-client-id>
GOOGLE_CLIENT_SECRET=<production-secret>
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/google/callback

# Frontend URL
FRONTEND_URL=https://yourdomain.com

# Server
PORT=5001
HOST=0.0.0.0
```

### Frontend (`.env.local`)
```bash
# NextAuth
NEXTAUTH_SECRET=<base64-secret>

# Backend API (Production URLs!)
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
NEXT_PUBLIC_WS_URL=https://yourdomain.com
```

---

## 🧪 Testing in Production

### 1. Test Google OAuth Flow
1. Navigate to `https://yourdomain.com/login`
2. Click "Sign in with Google"
3. Complete Google authentication
4. Verify redirect back to application
5. Check that JWT token is stored correctly
6. Test protected routes (e.g., `/chat`)

### 2. Test API Endpoints
```bash
# Test health endpoint
curl https://yourdomain.com/api/health

# Test authenticated endpoint (replace TOKEN with actual JWT)
curl -H "Authorization: Bearer TOKEN" https://yourdomain.com/api/auth/me
```

### 3. Monitor Logs
```bash
# Backend logs
tail -f /var/log/connectbest/backend.log

# Frontend logs (if using PM2)
pm2 logs connectbest-frontend
```

---

## ⚠️ Common Production Issues

### Issue 1: OAuth Redirect URI Mismatch
**Symptom**: Error after Google sign-in saying "redirect_uri_mismatch"

**Solution**:
1. Verify Google Cloud Console has correct URIs
2. Check `GOOGLE_REDIRECT_URI` in `backend/.env`
3. Ensure URIs use `https://` not `http://`
4. Match exact domain (with or without `www`)

### Issue 2: CORS Errors
**Symptom**: Browser console shows CORS policy errors

**Solution**:
1. Update `CORS_ORIGINS` in `backend/.env`
2. Include all frontend domains (with and without `www`)
3. Restart backend server
4. Clear browser cache

### Issue 3: MongoDB SSL/TLS Errors
**Symptom**: "SSL handshake failed" or connection timeout

**Solution**:
1. Ensure using Python 3.10+ (better SSL support)
2. Check MongoDB Atlas IP whitelist
3. Verify connection string has correct password encoding
4. Add `?retryWrites=true&w=majority` to connection string

### Issue 4: JWT Token Not Persisting
**Symptom**: User logged out on page refresh

**Solution**:
1. Check browser localStorage for `auth-token`
2. Verify JWT expiration time isn't too short
3. Check HTTPS is properly configured
4. Verify cookie SameSite settings for cross-domain

---

## 📈 Performance Optimization

### Backend
- Use Gunicorn with multiple workers: `-w 4`
- Enable connection pooling for MongoDB
- Implement Redis caching for session data
- Use CDN for static file uploads

### Frontend
- Enable Next.js image optimization
- Implement lazy loading for components
- Use environment-specific API endpoints
- Enable gzip compression

---

## 🔐 Security Best Practices

1. **Never commit `.env` files to Git**
   - Add to `.gitignore`
   - Use environment variables in CI/CD

2. **Rotate secrets regularly**
   - Change JWT secrets every 90 days
   - Update Google OAuth credentials annually

3. **Implement rate limiting**
   - Protect login endpoints from brute force
   - Limit API calls per user

4. **Enable MongoDB authentication**
   - Use strong passwords
   - Restrict network access with IP whitelist

5. **Monitor logs for suspicious activity**
   - Set up alerts for failed login attempts
   - Track unusual API usage patterns

---

## 📞 Support & Troubleshooting

### Log Locations
- Backend: `/var/log/connectbest/backend.log`
- Frontend: Check PM2 logs or Vercel dashboard
- MongoDB: MongoDB Atlas dashboard

### Useful Commands
```bash
# Check backend status
curl https://yourdomain.com/api/health

# View backend logs
tail -f backend.log

# Restart services
pm2 restart connectbest-frontend
systemctl restart connectbest-backend
```

### Required Versions
- Python: 3.11.7 or higher
- Node.js: 18.0.0 or higher
- MongoDB: 4.4 or higher
- Next.js: 15.0.3
- Flask: 3.0.0

---

## ✅ Final Deployment Checklist

Before going live:

- [ ] All environment variables updated with production values
- [ ] All secrets regenerated (never use development secrets)
- [ ] Google OAuth credentials created and configured
- [ ] MongoDB production database created and tested
- [ ] SSL certificates installed and HTTPS enabled
- [ ] CORS configured with production domains only
- [ ] `DEBUG=False` in backend
- [ ] Both frontend and backend building without errors
- [ ] OAuth flow tested end-to-end
- [ ] All API endpoints tested with real data
- [ ] Error monitoring and logging configured
- [ ] Backup strategy implemented for database
- [ ] Load testing completed
- [ ] Security scan performed
- [ ] DNS records configured correctly
- [ ] Firewall rules configured
- [ ] Team trained on deployment process

---

## 📝 Notes

- **Database Backups**: Set up automatic daily backups of MongoDB
- **Monitoring**: Use tools like Datadog, New Relic, or Sentry for production monitoring
- **Scaling**: Consider using Kubernetes or AWS ECS for horizontal scaling
- **CDN**: Use Cloudflare or AWS CloudFront for static assets
- **Email Service**: Configure SMTP for email verification (optional feature)

---

## 🎯 Quick Start Commands

```bash
# Backend Production Start
cd backend
python -m gunicorn -w 4 -b 0.0.0.0:5001 --worker-class eventlet -w 1 app:app

# Frontend Production Build & Start
npm run build
npm start

# Or using PM2
pm2 start npm --name "connectbest" -- start
```

---

**Last Updated**: December 5, 2025
**Version**: 1.0.0
**Authors**: ConnectBest Development Team
