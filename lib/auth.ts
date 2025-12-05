import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

// Backend API URL - Flask backend
// In production, we need to call the backend directly (internal ALB routing)
const BACKEND_API_URL = process.env.NODE_ENV === 'production'
  ? 'https://chat.connect-best.com/api'
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api');

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
          // Ensure we have a proper absolute URL for fetch
          const backendUrl = BACKEND_API_URL.startsWith('http')
            ? BACKEND_API_URL
            : `https://chat.connect-best.com${BACKEND_API_URL}`;

          // Call Flask backend directly
          const response = await fetch(`${backendUrl}/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          });

          const data = await response.json();

          if (!response.ok) {
            console.error('Login failed:', data);
            return null;
          }
          
          // Return user data from Flask backend
          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.full_name || data.user.username || data.user.email,
            role: data.user.role,
            phone: data.user.phone,
            image: data.user.avatar,
            accessToken: data.token // Store JWT token
          } as any;
        } catch (error) {
          console.error('Login error:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // For Google OAuth, you could register with Flask backend here
      if (account?.provider === "google" && user.email) {
        // Optional: Register Google users with Flask backend
        try {
          await fetch(`${BACKEND_API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: user.email,
              name: user.name,
              password: Math.random().toString(36), // Random password for OAuth users
              role: 'user'
            }),
          });
        } catch (error) {
          // User might already exist, that's ok
          console.log('Google user registration skipped');
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || 'user';
        token.phone = (user as any).phone;
        token.accessToken = (user as any).accessToken; // Store Flask JWT token
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).phone = token.phone;
        (session.user as any).accessToken = token.accessToken; // Pass JWT to client
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
