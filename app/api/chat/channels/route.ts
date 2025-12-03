import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { channelsCollection } from "@/lib/database";
import { ObjectId } from "mongodb";

/*
 * GET /api/chat/channels
 * 回傳 sidebar 需要的 channels 清單
 * 對應 lib/api.ts 的 listChannels()
 */
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const col = await channelsCollection();

  // 目前先回傳所有未刪除的非 DM 頻道（public/private）
  const docs = await col
    .find({
      isDeleted: { $ne: true },
      $or: [{ type: { $exists: false } }, { type: { $in: ["public", "private"] } }],
    })
    .sort({ createdAt: 1 })
    .toArray();

  const channels = docs.map((ch) => ({
    id: ch._id.toString(),
    name: ch.name ?? "Untitled",
    createdAt:
      ch.createdAt instanceof Date
        ? ch.createdAt.toISOString()
        : new Date().toISOString(),
  }));

  return NextResponse.json({ channels }, { status: 200 });
}

/*
 * POST /api/chat/channels
 * body: { name: string, description?: string }
 * 對應 lib/api.ts 的 createChannel()
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawName = typeof body.name === "string" ? body.name : "";
  const rawDescription = typeof body.description === "string" ? body.description : "";

  const name = rawName.trim();
  const description = rawDescription.trim();

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const col = await channelsCollection();
  const now = new Date();

  // 可選：避免重複 channel name（大小寫不敏感）
  const existing = await col.findOne({
    name: { $regex: `^${name}$`, $options: "i" },
    isDeleted: { $ne: true },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Channel with this name already exists" },
      { status: 409 }
    );
  }

  const doc = {
    name, // 存使用者輸入的 name
    description: description || undefined,
    type: "public" as const,
    createdBy: new ObjectId(session.user.id as string),
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: undefined,
  };

  const result = await col.insertOne(doc as any);

  return NextResponse.json(
    {
      channel: {
        id: result.insertedId.toString(),
        name,
        createdAt: now.toISOString(),
      },
    },
    { status: 200 }
  );
}