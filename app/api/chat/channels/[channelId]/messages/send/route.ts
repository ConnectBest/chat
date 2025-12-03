import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { messagesCollection } from "@/lib/database";

interface RouteContext {
  params: { channelId: string };
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { channelId } = params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const content: string | undefined =
    typeof body.content === "string" ? body.content.trim() : undefined;
  const parentMessageId: string | undefined =
    typeof body.parentMessageId === "string" ? body.parentMessageId : undefined;

  if (!content || content.length === 0) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  // channelId 支援：
  // - "xxx" -> 一般頻道：ObjectId
  // - "dm-xxx" -> DM：直接用字串存入 DB
  let channelKey: ObjectId | string;

  if (channelId.startsWith("dm-")) {
    channelKey = channelId;
  } else {
    if (!ObjectId.isValid(channelId)) {
      return NextResponse.json(
        { error: "Invalid channelId" },
        { status: 400 }
      );
    }
    channelKey = new ObjectId(channelId);
  }

  if (!ObjectId.isValid(session.user.id as string)) {
    return NextResponse.json(
      { error: "Invalid user id in session" },
      { status: 400 }
    );
  }

  const userObjectId = new ObjectId(session.user.id as string);
  const now = new Date();

  const doc: any = {
    channelId: channelKey,
    userId: userObjectId,
    content,
    isPinned: false,
    isEdited: false,
    isDeleted: false,
    status: "sent",
    createdAt: now,
    updatedAt: now,
  };

  if (parentMessageId && ObjectId.isValid(parentMessageId)) {
    doc.parentMessageId = new ObjectId(parentMessageId);
  }

  const col = await messagesCollection();
  const result = await col.insertOne(doc);

  return NextResponse.json(
    {
      message: {
        id: result.insertedId.toString(),
        channelId, // 回給前端仍然用原本的字串（ObjectId hex 或 "dm-xxx"）
        userId: session.user.id,
        userName: session.user.name ?? session.user.email ?? "Unknown",
        userAvatar: (session.user as any).image ?? null,
        content,
        status: "sent",
        isPinned: false,
        isEdited: false,
        isDeleted: false,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    },
    { status: 200 }
  );
}