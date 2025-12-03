import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { usersCollection } from "@/lib/database";
import { auth } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  // ★ 這裡把 params 型別改成 Promise
  { params }: { params: Promise<{ userId: string }> }
) {
  // ★ 先 await，才從裡面取 userId
  const { userId } = await params;

  // 1. 確認有登入
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. 檢查 ObjectId 格式
  if (!ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }

  const col = await usersCollection();
  const userDoc = await col.findOne({ _id: new ObjectId(userId) });

  if (!userDoc) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // 3. 只回前端需要的欄位（對齊 ChannelSidebar 用到的那些）
  const user = {
    id: userDoc._id.toString(),
    name: userDoc.name,
    email: userDoc.email,
    phone: userDoc.phone,
    status: userDoc.status,
    statusMessage: userDoc.statusMessage,
    avatarUrl: userDoc.avatarUrl,
  };

  return NextResponse.json({ user });
}