import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { sendVerificationEmail } from "@/lib/email";

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

// In-memory store for development - Static code Backend team please change it to dynamic
// In production, this will be replaced with actual database
const users: Map<string, {
  id: string;
  email: string;
  password?: string;
  name: string;
  role: 'admin' | 'user';
  phone?: string;
  emailVerified: Date | null;
  verificationToken?: string;
  verificationExpires?: Date;
  image?: string;
}> = new Map();

// Pre-populate with demo admin user
users.set('demo@test.com', {
  id: '1',
  email: 'demo@test.com',
  password: bcrypt.hashSync('demo123', 10),
  name: 'Demo Admin',
  role: 'admin',
  phone: '+1234567890',
  emailVerified: new Date(),
  image: undefined
});

// Pre-populate test users
users.set('alice@test.com', {
  id: '2',
  email: 'alice@test.com',
  password: bcrypt.hashSync('alice123', 10),
  name: 'Alice Johnson',
  role: 'user',
  emailVerified: new Date(),
});

users.set('bob@test.com', {
  id: '3',
  email: 'bob@test.com',
  password: bcrypt.hashSync('bob123', 10),
  name: 'Bob Smith',
  role: 'user',
  emailVerified: new Date(),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
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
        password: { label: "Password", type: "password" },
        verificationCode: { label: "Verification Code", type: "text" }
      },
      async authorize(credentials) {
        const parsedCredentials = z
          .object({ 
            email: z.string().email(), 
            password: z.string().min(6),
            verificationCode: z.string().optional()
          })
          .safeParse(credentials);

        if (!parsedCredentials.success) return null;

        const { email, password, verificationCode } = parsedCredentials.data;
        const user = users.get(email);

        if (!user || !user.password) return null;

        const passwordsMatch = await bcrypt.compare(password, user.password);
        if (!passwordsMatch) return null;

        // Check if email verification is required
        if (!user.emailVerified) {
          // Verify the code if provided
          if (verificationCode && user.verificationToken) {
            if (user.verificationToken === verificationCode && 
                user.verificationExpires && 
                user.verificationExpires > new Date()) {
              // Mark as verified
              user.emailVerified = new Date();
              user.verificationToken = undefined;
              user.verificationExpires = undefined;
              users.set(email, user);
            } else {
              throw new Error("Invalid or expired verification code");
            }
          } else {
            // Generate and send verification code
            const token = Math.random().toString(36).substring(2, 8).toUpperCase();
            user.verificationToken = token;
            user.verificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
            users.set(email, user);
            
            await sendVerificationEmail(email, token, user.name);
            throw new Error("VERIFICATION_REQUIRED");
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          phone: user.phone,
          image: user.image
        } as any;
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // For Google OAuth, create user if doesn't exist
      if (account?.provider === "google" && user.email) {
        let existingUser = users.get(user.email);
        
        if (!existingUser) {
          const newId = (users.size + 1).toString();
          existingUser = {
            id: newId,
            email: user.email,
            name: user.name || 'Unknown',
            role: 'user', // Default role for new Google users
            emailVerified: new Date(), // Google emails are pre-verified
            image: user.image || undefined,
          };
          users.set(user.email, existingUser);
        } else if (existingUser) {
          // Update image if Google login
          existingUser.image = user.image || undefined;
          existingUser.emailVerified = new Date();
          users.set(user.email, existingUser);
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        const dbUser = users.get(user.email!);
        token.id = user.id || dbUser?.id;
        token.role = (user as any).role || dbUser?.role || 'user';
        token.phone = (user as any).phone || dbUser?.phone;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).phone = token.phone;
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

// Export user store for registration
export { users };
