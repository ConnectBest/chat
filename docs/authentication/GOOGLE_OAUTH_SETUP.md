# Google OAuth Setup Guide

Follow these steps to set up Google OAuth for your application:

## Step 1: Go to Google Cloud Console
1. Open your browser and go to: **https://console.cloud.google.com/**
2. Sign in with your Google account

## Step 2: Create a New Project (or select existing)
1. Click on the project dropdown at the top of the page
2. Click **"NEW PROJECT"**
3. Enter project name: `ConnectBest Chat` (or any name you prefer)
4. Click **"CREATE"**
5. Wait for the project to be created and select it

## Step 3: Enable Google+ API
1. In the left sidebar, click **"APIs & Services"** → **"Library"**
2. Search for **"Google+ API"**
3. Click on it and press **"ENABLE"**
4. Wait for it to be enabled

## Step 4: Configure OAuth Consent Screen
1. In the left sidebar, click **"OAuth consent screen"**
2. Select **"External"** user type
3. Click **"CREATE"**
4. Fill in the required fields:
   - **App name**: `ConnectBest Chat`
   - **User support email**: Your email address
   - **Developer contact email**: Your email address
5. Click **"SAVE AND CONTINUE"**
6. On the "Scopes" page, click **"SAVE AND CONTINUE"** (no changes needed)
7. On the "Test users" page, click **"SAVE AND CONTINUE"** (no changes needed)
8. Click **"BACK TO DASHBOARD"**

## Step 5: Create OAuth 2.0 Credentials
1. In the left sidebar, click **"Credentials"**
2. Click **"+ CREATE CREDENTIALS"** at the top
3. Select **"OAuth client ID"**
4. Choose **"Web application"** as the application type
5. Enter a name: `ConnectBest Chat Web Client`
6. Under **"Authorized JavaScript origins"**, click **"+ ADD URI"** and add:
   ```
   http://localhost:3000
   ```
7. Under **"Authorized redirect URIs"**, click **"+ ADD URI"** and add:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
8. Click **"CREATE"**

## Step 6: Copy Your Credentials
1. A popup will show your **Client ID** and **Client Secret**
2. Copy the **Client ID** - it looks like: `123456789-abcdefghijklmnop.apps.googleusercontent.com`
3. Copy the **Client Secret** - it looks like: `GOCSPX-AbCdEfGhIjKlMnOpQrStUvWxYz`
4. Keep these safe!

## Step 7: Update Your .env.local File
1. Open `/Users/spartan/Desktop/Project frontend/chat/.env.local`
2. Replace the empty values:
   ```env
   GOOGLE_CLIENT_ID=your-client-id-here
   GOOGLE_CLIENT_SECRET=your-client-secret-here
   ```
3. Save the file
4. Restart your development server

## Step 8: Restart Your Dev Server
Run this command in your terminal:
```bash
cd /Users/spartan/Desktop/Project\ frontend/chat
pkill -f "next dev"
npm run dev
```

## Step 9: Test Google Sign-In
1. Go to: http://localhost:3000/login
2. Click the **"Sign in with Google"** button
3. Select your Google account
4. Grant permissions
5. You should be redirected to the chat application!

## Production Setup (Later)
When deploying to production, you'll need to:
1. Add your production domain to **"Authorized JavaScript origins"**:
   ```
   https://yourdomain.com
   ```
2. Add your production callback to **"Authorized redirect URIs"**:
   ```
   https://yourdomain.com/api/auth/callback/google
   ```
3. Update `NEXTAUTH_URL` in your production environment variables
4. Publish your OAuth consent screen (move from Testing to Production)

## Troubleshooting
- **Error 401: invalid_client**: Your credentials are incorrect or not set
- **Redirect URI mismatch**: Make sure the redirect URI exactly matches what you configured
- **Access blocked**: Make sure OAuth consent screen is configured
- **User not found after Google sign-in**: Check the console logs to see if auto-registration worked

## Notes
- New Google accounts will automatically be created with **"user"** role
- To make a Google user an admin, you'll need to update their role in the database later
- In development, the app is in "Testing" mode and only works for accounts you explicitly add as test users in the OAuth consent screen (OR you can use it with any Google account if you're the owner)

---
**Current Status**: Waiting for you to complete steps 1-7 above and provide your credentials.
