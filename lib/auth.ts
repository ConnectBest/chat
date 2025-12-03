import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { sendVerificationEmail } from "@/lib/email";
import { usersCollection } from "@/lib/database";
import type { ObjectId } from "mongodb";
import type { UserDocument } from "@/lib/database";

// 最後給前端 / session 用的 User 型別
export interface ExtendedUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  phone?: string;
  // 這裡改成 boolean，與 UserDocument.emailVerified 一致
  emailVerified: boolean;
  image?: string;
}

// Helpers
async function findUserByEmail(email: string) {
  const col = await usersCollection();
  return col.findOne({ email });
}

function toExtendedUser(doc: UserDocument): ExtendedUser {
  return {
    id: (doc._id as ObjectId).toString(),
    name: doc.name,
    email: doc.email,
    role: doc.role,
    phone: doc.phone,
    // boolean -> boolean
    emailVerified: !!doc.emailVerified,
    image: doc.avatarUrl,
  };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),

    // ----------------- Credentials：Email + Password + 驗證碼 -----------------
    Credentials({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        verificationCode: { label: "Verification Code", type: "text" },
      },
      async authorize(raw) {
        const parsed = z
          .object({
            email: z.string().email(),
            password: z.string().min(6),
            verificationCode: z.string().optional(),
          })
          .safeParse(raw);

        if (!parsed.success) return null;

        const { email, password, verificationCode } = parsed.data;
        const col = await usersCollection();
        const userDoc = await col.findOne({ email });

        if (!userDoc || !userDoc.passwordHash) {
          return null;
        }

        // 1) 比對密碼
        const ok = await bcrypt.compare(password, userDoc.passwordHash);
        if (!ok) return null;

        const now = new Date();

        // 2) 如果已經驗證過，直接登入
        if (userDoc.emailVerified) {
          await col.updateOne(
            { _id: userDoc._id },
            {
              $set: {
                lastLogin: now,
                lastSeen: now,
                updatedAt: now,
              },
            }
          );
          return toExtendedUser(userDoc) as any;
        }

        // 3) 還沒驗證過 → 驗證碼流程
        if (verificationCode) {
          // 3-1 有帶驗證碼 → 檢查 token 是否存在 & 是否過期 & 是否相符
          const hasToken =
            !!userDoc.verificationToken && !!userDoc.verificationExpires;
          const notExpired =
            hasToken && userDoc.verificationExpires! > now;
          const validToken =
            hasToken &&
            notExpired &&
            verificationCode === userDoc.verificationToken;

          if (!validToken) {
            // 這裡是登入真正失敗的 case
            throw new Error("Invalid or expired verification code");
          }

          // 3-2 驗證成功 → 更新 emailVerified & 清除 token
          await col.updateOne(
            { _id: userDoc._id },
            {
              $set: {
                emailVerified: true,
                updatedAt: now,
              },
              // 用 $unset 來清掉 token，避免型別問題
              $unset: {
                verificationToken: "",
                verificationExpires: "",
              },
            }
          );

          userDoc.emailVerified = true;
        } else {
          // 3-3 沒有帶驗證碼 → 產生 / 重用驗證碼，寄信 & 丟 VERIFICATION_REQUIRED
          let token = userDoc.verificationToken;
          let expires = userDoc.verificationExpires;

          const hasValidExisting =
            !!token && !!expires && expires > now;

          if (!hasValidExisting) {
            token = Math.random()
              .toString(36)
              .substring(2, 8)
              .toUpperCase();
            expires = new Date(Date.now() + 15 * 60 * 1000); // 15 分鐘

            await col.updateOne(
              { _id: userDoc._id },
              {
                $set: {
                  verificationToken: token,
                  verificationExpires: expires,
                  updatedAt: now,
                },
              }
            );
          }

          await sendVerificationEmail(userDoc.email, token!, userDoc.name);
          throw new Error("VERIFICATION_REQUIRED");
        }

        // 4) 組 ExtendedUser 回傳給 next-auth
        return toExtendedUser(userDoc) as any;
      },
    }),
  ],

  // ----------------- Callbacks：Google OAuth & JWT / session payload -----------------
  callbacks: {
    /**
     * Google OAuth 第一次登入 / 每次登入時跑這裡
     */
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const col = await usersCollection();
        const existing = await col.findOne({ email: user.email });
        const now = new Date();

        if (!existing) {
          // 新增一個 user（註冊）
          const newUser: Omit<UserDocument, "_id"> = {
            email: user.email,
            passwordHash: null,
            name: user.name ?? "Unknown",
            phone: undefined,
            role: "user",
            status: "online",
            statusMessage: "",
            avatarUrl: user.image ?? undefined,
            emailVerified: true, // Google 視為已驗證
            // 這些欄位在 UserDocument 是可選的，因此用 undefined 或完全省略
            verificationToken: undefined,
            verificationExpires: undefined,
            resetToken: undefined,
            resetExpires: undefined,
            twoFAEnabled: false,
            twoFASecret: undefined,
            googleId: account.providerAccountId,
            lastLogin: now,
            lastSeen: now,
            accountStatus: "active",
            suspensionReason: undefined,
            preferences: {
              notifications: true,
              soundEnabled: true,
              timezone: "UTC",
            },
            createdAt: now,
            updatedAt: now,
            deletedAt: undefined,
          };

          const insertResult = await col.insertOne(newUser as any);
          (user as any).id = insertResult.insertedId.toString();
          (user as any).role = "user";
        } else {
          // 已存在 → 更新 lastLogin / lastSeen / avatar / googleId
          await col.updateOne(
            { _id: existing._id },
            {
              $set: {
                googleId: account.providerAccountId,
                lastLogin: now,
                lastSeen: now,
                emailVerified: true,
                avatarUrl: user.image ?? existing.avatarUrl,
                updatedAt: now,
              },
            }
          );

          (user as any).id = (existing._id as ObjectId).toString();
          (user as any).role = existing.role;
        }
      }

      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role ?? "user";
        token.phone = (user as any).phone;
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
    signIn: "/login",
    error: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  secret:
    process.env.NEXTAUTH_SECRET || "development-secret-change-in-production",
});