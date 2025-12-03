import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { sendVerificationEmail } from "@/lib/email";
import { usersCollection, UserDocument } from "@/lib/database";

export const runtime = "nodejs";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().optional(),
  role: z.enum(["admin", "user"]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { email, password, name, phone, role } = parsed.data;

    // 1) 檢查是否已存在
    const col = await usersCollection();
    const existing = await col.findOne({ email });

    if (existing) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 }
      );
    }

    // 2) Hash 密碼
    const passwordHash = await bcrypt.hash(password, 10);

    // 3) 產生驗證碼 & 過期時間
    const verificationToken = Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();
    const verificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 分鐘
    const now = new Date();

    // 4) 建立符合 UserDocument schema 的新 user（不帶 _id）
    const newUser: Omit<UserDocument, "_id"> = {
      email,
      passwordHash,
      name,
      phone,
      role: role ?? "user",
      status: "offline",
      statusMessage: "",
      avatarUrl: undefined,
      emailVerified: false, // 尚未驗證
      verificationToken,
      verificationExpires,
      resetToken: undefined,
      resetExpires: undefined,
      twoFAEnabled: false,
      twoFASecret: undefined,
      // <== 這裡**不再放 googleId**，讓一般 Email 註冊完全不帶這個欄位
      lastLogin: undefined,
      lastSeen: undefined,
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

    // 5) 寫入 MongoDB
    const insertResult = await col.insertOne(
      newUser as unknown as UserDocument
    );

    // 6) 寄出驗證信
    await sendVerificationEmail(email, verificationToken, name);

    // 7) 回傳結果
    return NextResponse.json(
      {
        message:
          "Registration successful! Please check your email for verification code.",
        userId: insertResult.insertedId.toString(),
        requiresVerification: true,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Registration error:", error);

    // 處理 unique index 衝突（email 或 googleId）
    if (error?.code === 11000) {
      const key = Object.keys(error.keyPattern ?? {})[0] ?? "field";
      return NextResponse.json(
        {
          error:
            key === "email"
              ? "User with this email already exists"
              : "User conflict on " + key,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to register user" },
      { status: 500 }
    );
  }
}