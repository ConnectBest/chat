import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { usersCollection } from "@/lib/database";
import { ObjectId } from "mongodb";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id as string;
  const users = await usersCollection();

  const existing = await users.findOne({ _id: new ObjectId(userId) });
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // 已經啟用過 2FA 的話，就不要重複產生 secret
  if ((existing as any).twoFactorEnabled) {
    return NextResponse.json(
      {
        twoFactorEnabled: true,
        alreadyEnabled: true,
      },
      { status: 200 }
    );
  }

  // 簡單產一組 secret（正式環境應配合 TOTP / QR Code）
  const secret = crypto.randomBytes(20).toString("hex");

  await users.updateOne(
    { _id: new ObjectId(userId) },
    {
      $set: {
        twoFactorEnabled: true,
        twoFactorSecret: secret, // 先存起來，之後可以拿來做 TOTP
        updatedAt: new Date(),
      },
    }
  );

  return NextResponse.json(
    {
      twoFactorEnabled: true,
      // Demo 專案可以回傳 secret，正式系統通常不會直接這樣丟回前端
      secret,
    },
    { status: 200 }
  );
}