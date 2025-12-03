import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { messagesCollection, usersCollection } from "@/lib/database";
import { ObjectId } from "mongodb";

interface RouteContext {
  // Next 15: params 是 Promise
  params: Promise<{ channelId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ✅ 一定要先 await params
  const { channelId } = await params;

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? "50");

  const msgCol = await messagesCollection();

  // ✅ 同時支援一般頻道(_id) & DM ("dm-xxx")，但不要用 string | ObjectId
  let mongoFilter: any;

  if (channelId.startsWith("dm-")) {
    // DM：channelId 直接用字串
    mongoFilter = {
      channelId,            // string
      isDeleted: { $ne: true },
    };
  } else {
    // 一般頻道：channelId 必須是合法 ObjectId
    if (!ObjectId.isValid(channelId)) {
      console.warn("[messages] invalid channelId:", channelId);
      return NextResponse.json({ messages: [] });
    }

    mongoFilter = {
      channelId: new ObjectId(channelId),  // ObjectId
      isDeleted: { $ne: true },
    };
  }

  const msgDocs = await msgCol
    .find(mongoFilter)           // ✅ 不再是 string | ObjectId，所以 TS 不會喊
    .sort({ createdAt: -1 })     // 最新在前
    .limit(limit)
    .toArray();

  if (!msgDocs.length) {
    return NextResponse.json({ messages: [] });
  }

  // 一次把所有 user 撈出來，組 map
  const userIds = [
    ...new Set(msgDocs.map((m) => m.userId.toString())),
  ].map((id) => new ObjectId(id));

  const userCol = await usersCollection();
  const userDocs = await userCol.find({ _id: { $in: userIds } }).toArray();

  const userMap = new Map<string, any>(
    userDocs.map((u) => [u._id.toString(), u])
  );

  const messages = msgDocs
    .reverse() // 前端要舊 → 新
    .map((m) => {
      const user = userMap.get(m.userId.toString());

      const created =
        m.createdAt instanceof Date
          ? m.createdAt
          : new Date(m.createdAt);

      const updated =
        m.updatedAt instanceof Date
          ? m.updatedAt
          : m.updatedAt
          ? new Date(m.updatedAt)
          : created;

      return {
        id: m._id.toString(),
        channelId:
          typeof m.channelId === "string"
            ? m.channelId
            : m.channelId.toString(),
        userId: m.userId.toString(),
        userName: user?.name ?? "Unknown",
        userAvatar: user?.avatarUrl ?? undefined,
        content: m.content,
        status: m.status ?? "sent",
        createdAt: created.toISOString(),
        updatedAt: updated.toISOString(),
      };
    });

  return NextResponse.json({ messages }, { status: 200 });
}