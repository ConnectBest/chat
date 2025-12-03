import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { usersCollection } from "@/lib/database";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // 1) 先確認有登入
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id as string;

  // 2) 解析 body
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { currentPassword, newPassword } = body ?? {};

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "currentPassword and newPassword are required" },
      { status: 400 }
    );
  }

  // 3) 從 DB 找 user
  const users = await usersCollection();
  const user = await users.findOne({ _id: new ObjectId(userId) });

  if (!user || !user.passwordHash) {
    return NextResponse.json(
      { error: "User not found or password not set" },
      { status: 404 }
    );
  }

  // 4) 比對舊密碼
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) {
    return NextResponse.json(
      { error: "Current password is incorrect" },
      { status: 400 }
    );
  }

  // 5) 產生新的 hash 並更新
  const newHash = await bcrypt.hash(newPassword, 10);

  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        passwordHash: newHash,
        updatedAt: new Date(),
      },
    }
  );

  return NextResponse.json(
    { success: true, message: "Password updated" },
    { status: 200 }
  );
}