import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getMongoClient } from './mongodb';

/**
 * Generate a Flask-compatible JWT token using Node.js crypto
 * This matches the format expected by Flask's @token_required decorator
 */
function generateFlaskJwt(userId: string, email: string, role: string, name?: string, phone?: string): string {
  const jwtSecret = process.env.JWT_SECRET_KEY || process.env.NEXTAUTH_SECRET;

  if (!jwtSecret) {
    throw new Error('JWT_SECRET_KEY not configured');
  }

  const now = Math.floor(Date.now() / 1000);
  const expirationHours = parseInt(process.env.JWT_EXPIRATION_HOURS || '168', 10);

  // Create JWT payload matching Flask backend expectations
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const payload = {
    user_id: userId,
    id: userId,
    sub: userId,
    email: email,
    role: role || 'user',
    name: name,
    phone: phone,
    iat: now,
    exp: now + (expirationHours * 60 * 60)
  };

  // Encode header and payload
  const base64UrlEncode = (obj: any) => {
    return Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  };

  const encodedHeader = base64UrlEncode(header);
  const encodedPayload = base64UrlEncode(payload);

  // Create signature using HMAC SHA256
  const crypto = require('crypto');
  const signature = crypto
    .createHmac('sha256', jwtSecret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

// Extended user type with role and phone
export interface ExtendedUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  phone?: string;
  emailVerified: Date | null;
  image?: string;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  debug: process.env.NODE_ENV === 'development' || process.env.NEXTAUTH_DEBUG === 'true',
  trustHost: true, // Required for deployment behind proxies/load balancers
  useSecureCookies: process.env.NODE_ENV === 'production',
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
    Credentials({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const parsedCredentials = z
          .object({
            email: z.string().email(),
            password: z.string().min(6)
          })
          .safeParse(credentials);

        if (!parsedCredentials.success) return null;

        const { email, password } = parsedCredentials.data;

        try {
          console.log('🔍 [NextAuth] Connecting to MongoDB for user validation...');

          // Connect to MongoDB directly
          const client = await getMongoClient();
          const db = client.db(process.env.MONGODB_DB_NAME || 'chatapp');
          const usersCollection = db.collection('users');

          // Find user by email
          const user = await usersCollection.findOne({
            email: email.toLowerCase().trim()
          });

          if (!user) {
            console.log('❌ [NextAuth] User not found:', email);
            return null;
          }

          // Verify password using bcrypt (matching Flask's implementation)
          if (!user.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
            console.log('❌ [NextAuth] Invalid password for user:', email);
            return null;
          }

          console.log('✅ [NextAuth] User authenticated successfully:', email);

          // Update last login timestamp
          await usersCollection.updateOne(
            { _id: user._id },
            { $set: { last_login: new Date() } }
          );

          // Return user data for NextAuth session
          return {
            id: user._id.toString(),
            email: user.email,
            name: user.full_name || user.username || user.email,
            role: user.role || 'user',
            phone: user.phone,
            image: user.avatar,
            emailVerified: user.email_verified ? new Date() : null
          } as any;
        } catch (error) {
          console.error('❌ [NextAuth] Database authentication error:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // For Google OAuth, ensure user exists in our database
      if (account?.provider === "google" && user.email) {
        try {
          console.log('🔍 [NextAuth] Processing Google OAuth sign in for:', user.email);

          const client = await getMongoClient();
          const db = client.db(process.env.MONGODB_DB_NAME || 'chatapp');
          const usersCollection = db.collection('users');

          // Check if user already exists
          let existingUser = await usersCollection.findOne({
            email: user.email.toLowerCase().trim()
          });

          if (!existingUser) {
            console.log('🆕 [NextAuth] Creating new Google OAuth user:', user.email);

            // Create new user for Google OAuth
            const newUserDoc = {
              email: user.email.toLowerCase().trim(),
              username: user.email.split('@')[0].toLowerCase().trim(),
              password_hash: null, // OAuth users don't have passwords
              full_name: user.name || '',
              avatar: user.image,
              role: 'user',
              status: 'online',
              email_verified: true, // Google OAuth users are pre-verified
              verification_token: null,
              verification_expires: null,
              two_factor_enabled: false,
              two_factor_secret: null,
              backup_codes: [],
              google_id: profile?.sub,
              oauth_provider: 'google',
              created_at: new Date(),
              updated_at: new Date(),
              last_login: new Date(),
            };

            const result = await usersCollection.insertOne(newUserDoc);
            existingUser = { ...newUserDoc, _id: result.insertedId };

            console.log('✅ [NextAuth] Created Google OAuth user with ID:', result.insertedId);
          } else {
            console.log('✅ [NextAuth] Existing Google OAuth user found:', user.email);

            // Update last login and Google profile info
            await usersCollection.updateOne(
              { _id: existingUser._id },
              {
                $set: {
                  last_login: new Date(),
                  avatar: user.image, // Update avatar from Google
                  google_id: profile?.sub,
                  oauth_provider: 'google'
                }
              }
            );
          }

          // Store user info for session
          (user as any).id = existingUser._id.toString();
          (user as any).role = existingUser.role || 'user';
          (user as any).phone = existingUser.phone;

        } catch (error) {
          console.error('❌ [NextAuth] Google OAuth error:', error);
          return false; // Prevent sign in on error
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || 'user';
        token.phone = (user as any).phone;
        token.emailVerified = (user as any).emailVerified;

        // Generate Flask-compatible JWT token for backend API calls
        // This token matches the format expected by Flask's @token_required decorator
        try {
          const flaskJwt = generateFlaskJwt(
            token.id as string,
            token.email as string,
            token.role as string,
            token.name as string | undefined,
            token.phone as string | undefined
          );

          token.flaskAccessToken = flaskJwt;
          console.log('✅ [NextAuth] Generated Flask-compatible JWT token for user:', token.email);
        } catch (error) {
          console.error('❌ [NextAuth] Error generating Flask JWT:', error);
          // Don't block login, but log the error
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).phone = token.phone;
        (session.user as any).emailVerified = token.emailVerified;

        // CRITICAL FIX: Include Flask-compatible JWT token for API calls
        // This token is signed with JWT_SECRET_KEY and can be validated by Flask backend
        (session.user as any).accessToken = token.flaskAccessToken;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET || "development-secret-change-in-production",
});
