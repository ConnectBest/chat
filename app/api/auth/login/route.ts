import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { usersCollection } from "@/lib/database";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, password } = body as {
      email?: string;
      password?: string;
    };

    // 1) 基本欄位檢查
    if (!email || !password) {
      return NextResponse.json(
        { error: "email and password required" },
        { status: 400 }
      );
    }

    // 2) 從 Mongo 找 user
    const col = await usersCollection();
    const userDoc = await col.findOne({ email });

    if (!userDoc || !userDoc.passwordHash) {
      // 找不到或沒有本地密碼（可能只用 Google 登入）
      return NextResponse.json(
        { error: "invalid credentials" },
        { status: 401 }
      );
    }

    // 3) 比對密碼
    const ok = await bcrypt.compare(password, userDoc.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: "invalid credentials" },
        { status: 401 }
      );
    }

    // 4) 可以視情況檢查 email 是否已驗證
    //    如果你希望未驗證不能登入，可以打開這段
    if (!userDoc.emailVerified) {
      return NextResponse.json(
        { error: "email not verified" },
        { status: 403 }
      );
    }

    // 5) 組 response 用的 user 物件（避免把 passwordHash 傳回前端）
    const user = {
      id: userDoc._id.toString(),
      email: userDoc.email,
      name: userDoc.name,
      role: userDoc.role,
      phone: userDoc.phone,
      emailVerified: userDoc.emailVerified,
      image: userDoc.avatarUrl,
    };

    // 6) 依照原本 mock 版本一樣，簡單做一個 token 回傳
    const token = Buffer.from(user.id).toString("base64");

    return NextResponse.json(
      {
        user,
        token,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "Failed to login" },
      { status: 500 }
    );
  }
}