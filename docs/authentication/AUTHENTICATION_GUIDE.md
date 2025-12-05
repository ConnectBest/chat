# 🔐 Authentication & Authorization Implementation Guide

## Overview
This application now uses **NextAuth.js v5** with Google OAuth, Email/Password authentication, and 2FA email verification.

## 🎯 Key Features Implemented

### 1. **Google OAuth Sign-In**
- One-click sign-in with Google account
- Automatic user creation on first sign-in
- Email pre-verified for Google users
- Default role: `user` (can be changed in database)

### 2. **Email/Password Authentication with 2FA**
- User registration with email verification
- 6-digit verification code sent via email
- Code expires in 15 minutes
- Magic link included in email for one-click verification

### 3. **Role-Based Access Control (RBAC)**
- **Two roles**: `admin` and `user`
- **Admin users** can access:
  - Admin Dashboard (`/admin`) - User/channel management
  - Ops Dashboard (`/ops`) - System monitoring
  - All regular user features
- **Regular users** are redirected if they try to access admin routes

### 4. **User Registration with Role Selection**
- Users choose account type during signup:
  - 👤 **User**: Standard access to chat
  - 👑 **Admin**: Full system access
- Password strength requirement: minimum 8 characters
- Optional phone number field
- Email verification required before login

## 📧 Email Verification Flow

### Registration:
1. User fills registration form and selects role
2. Account created with `emailVerified: null`
3. Verification email sent with 6-digit code
4. User redirected to login page

### Login (Unverified Users):
1. User enters email/password
2. System detects unverified email
3. New verification code generated and sent
4. User enters code or clicks link from email
5. Email marked as verified → Login successful

### Login (Verified Users):
1. User enters email/password
2. Immediate login (no verification needed)

## 🔑 Pre-configured Test Accounts

```javascript
// Admin Account (Email Verified)
Email: demo@test.com
Password: demo123
Role: admin
Access: Full (Admin + Ops Dashboards)

// User Accounts (Email Verified)
Email: alice@test.com
Password: alice123
Role: user

Email: bob@test.com
Password: bob123
Role: user
```

## 🚀 Setup Instructions

### 1. Install Dependencies (Already Done)
```bash
npm install next-auth@beta nodemailer bcryptjs
npm install -D @types/bcryptjs @types/nodemailer
```

### 2. Configure Environment Variables
Create `.env.local` file in the project root:

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-a-random-secret-here

# Google OAuth (Get from Google Cloud Console)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email (Gmail example)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-gmail-app-password
EMAIL_FROM=noreply@yourdomain.com

NODE_ENV=development
```

### 3. Get Google OAuth Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Google+ API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Set **Authorized redirect URIs**:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://yourdomain.com/api/auth/callback/google` (production)
6. Copy **Client ID** and **Client Secret**

### 4. Gmail App Password (for Email Verification)
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification**
3. Go to **App Passwords**
4. Generate password for "Mail"
5. Use this as `EMAIL_PASSWORD` in `.env.local`

## 🧪 Testing the System

### Test Email Verification (Development Mode)
In development, verification codes are logged to console instead of actually sending emails:

```bash
# Start dev server
npm run dev

# Register new user → Check terminal output
📧 Email Verification (Development Mode)
To: newuser@test.com
Code: A1B2C3
Login URL: http://localhost:3000/login?verify=A1B2C3
```

### Test Role-Based Access
1. **As Regular User** (`alice@test.com`):
   - ✅ Can access `/chat/*`
   - ✅ Can access `/profile`
   - ❌ Redirected from `/admin` and `/ops`

2. **As Admin** (`demo@test.com`):
   - ✅ Can access all routes
   - ✅ Can manage users in Admin Dashboard
   - ✅ Can monitor system in Ops Dashboard

## 🔄 How to Identify Admin Users

### Method 1: Check Session (Client-Side)
```typescript
import { useSession } from 'next-auth/react';

export function MyComponent() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === 'admin';
  
  return isAdmin ? <AdminContent /> : <UserContent />;
}
```

### Method 2: Check Session (Server-Side)
```typescript
import { auth } from '@/lib/auth';

export default async function Page() {
  const session = await auth();
  const isAdmin = (session?.user as any)?.role === 'admin';
  
  if (!isAdmin) {
    redirect('/chat/general');
  }
  
  return <AdminPage />;
}
```

### Method 3: Check in API Routes
```typescript
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  
  if ((session?.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  // Admin-only logic here
}
```

## 📊 User Data Structure

```typescript
interface ExtendedUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  phone?: string;
  emailVerified: Date | null;
  image?: string;
}
```

## 🔐 Security Features

1. **Password Hashing**: bcrypt with 10 salt rounds
2. **JWT Sessions**: Secure token-based sessions (30-day expiry)
3. **Email Verification**: Required before first login
4. **Code Expiration**: Verification codes expire in 15 minutes
5. **Role-Based Middleware**: Automatic route protection
6. **HTTPS Required**: In production (enforced by NextAuth)

## 🎨 UI/UX Features

- Google sign-in button with brand colors
- Verification code input (6-digit, centered, large text)
- Role selection with visual cards (👤 User / 👑 Admin)
- Real-time validation with Zod
- Loading states on all forms
- Success/error notifications
- Mobile-responsive design

## 🔧 Future Integration with Vijay's Backend

When backend is ready, replace the in-memory `users` Map with actual database calls:

```typescript
// lib/auth.ts
// Replace this:
const users: Map<string, User> = new Map();

// With this:
import { db } from '@/lib/database';

async function getUserByEmail(email: string) {
  return await db.user.findUnique({ where: { email } });
}

async function createUser(data: UserData) {
  return await db.user.create({ data });
}
```

## 📝 Notes

- **Development Mode**: Verification emails logged to console
- **Production Mode**: Actual emails sent via SMTP
- **Mock Data**: Pre-populated users for testing
- **Session Storage**: JWT tokens (no database sessions yet)
- **Unique Identification**: Users identified by email (unique) or ID

## 🚨 Important Security Reminders

1. **Change** `NEXTAUTH_SECRET` in production
2. **Never commit** `.env.local` to version control
3. **Use HTTPS** in production
4. **Rotate** Google OAuth secrets periodically
5. **Enable** rate limiting for auth endpoints (future)
6. **Add** CAPTCHA for registration (future enhancement)

---

**Status**: ✅ Fully functional with mock data. Ready for backend integration by Vijay.
