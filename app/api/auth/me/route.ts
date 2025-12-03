import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { usersCollection } from "@/lib/database";
import { ObjectId } from "mongodb";

export async function GET() {
  // 1) 從 NextAuth 拿現在登入的 session
  const session = await auth();

  if (!session?.user?.id) {
    // 沒登入就回 user: null（前端可以當成未登入處理）
    return NextResponse.json({ user: null }, { status: 200 });
  }

  try {
    const col = await usersCollection();
    const doc = await col.findOne({
      _id: new ObjectId(session.user.id),
    });

    if (!doc) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    // 2) 統一整理成前端好用的 user 物件
    const user = {
      id: doc._id.toString(),
      name: doc.name,
      email: doc.email,
      role: doc.role ?? "user",
      status: doc.status ?? "active",
      avatarUrl: doc.avatarUrl ?? null,
      createdAt: doc.createdAt?.toISOString?.() ?? null,
    };

    return NextResponse.json({ user }, { status: 200 });
  } catch (err) {
    console.error("[/api/auth/me] error:", err);
    // 這裡不要丟 500 給前端爆紅，可以一律回 user: null
    return NextResponse.json({ user: null }, { status: 200 });
  }
}