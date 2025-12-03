import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { usersCollection, dmChannelsCollection } from "@/lib/database";

/*
 * 把使用者的完整狀態（online/away/busy/inmeeting/offline）
 * 收斂成 DM sidebar 需要的 3 種狀態
 */
function toSidebarStatus(
  status: any
): "online" | "away" | "offline" {
  if (status === "online") return "online";
  if (status === "offline") return "offline";
  // busy / inmeeting / away 都算在 away
  return "away";
}

/*
 * GET /api/dms
 * 回傳目前使用者的所有 DM 列表（給 sidebar 用）
 * 對應前端：api.listDirectMessages() -> { dms: DirectMessageSidebarItem[] }
 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ObjectId.isValid(session.user.id as string)) {
    return NextResponse.json(
      { error: "Invalid current user id" },
      { status: 400 }
    );
  }

  const currentUserId = new ObjectId(session.user.id as string);
  const dmCol = await dmChannelsCollection();
  const userCol = await usersCollection();

  // 找出所有包含 currentUserId 的 dmChannels
  const dmDocs = await dmCol
    .find({ userIds: currentUserId })
    .sort({ updatedAt: -1 })
    .toArray();

  if (!dmDocs.length) {
    return NextResponse.json({ dms: [] }, { status: 200 });
  }

  // 收集「對方」的 userId
  const otherUserIds: ObjectId[] = [];
  for (const dm of dmDocs) {
    const other = (dm.userIds as ObjectId[]).find(
      (id) => !id.equals(currentUserId)
    );
    if (other) otherUserIds.push(other);
  }

  if (!otherUserIds.length) {
    return NextResponse.json({ dms: [] }, { status: 200 });
  }

  // 撈對方 user 資料（排除刪除帳號）
  const users = await userCol
    .find({
      _id: { $in: otherUserIds },
      accountStatus: { $ne: "deleted" },
    })
    .toArray();

  const userMap = new Map<string, (typeof users)[number]>();
  for (const u of users) {
    userMap.set(u._id.toString(), u);
  }

  // 組成前端要的格式
  const dms = dmDocs
    .map((dm) => {
      const other = (dm.userIds as ObjectId[]).find(
        (id) => !id.equals(currentUserId)
      );
      if (!other) return null;

      const otherUser = userMap.get(other.toString());
      if (!otherUser) return null;

      return {
        userId: other.toString(),
        userName: otherUser.name ?? otherUser.email ?? "Unknown",
        userAvatar: otherUser.avatarUrl ?? undefined,
        status: toSidebarStatus(otherUser.status),
        lastMessage: dm.lastMessageText ?? "",
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  return NextResponse.json({ dms }, { status: 200 });
}

/**
 * POST /api/dms
 * Body: { userId: string }
 * 如果 DM 已存在就回傳既有的；沒有就建立一個新的
 * 對應前端：api.createDirectMessage(userId) -> { dm: DirectMessageSidebarItem }
 */
export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ObjectId.isValid(session.user.id as string)) {
    return NextResponse.json(
      { error: "Invalid current user id" },
      { status: 400 }
    );
  }

  const currentUserId = new ObjectId(session.user.id as string);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userId = body?.userId;

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  if (userId === session.user.id) {
    return NextResponse.json(
      { error: "Cannot create DM with yourself" },
      { status: 400 }
    );
  }

  if (!ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }

  const otherUserId = new ObjectId(userId);

  const userCol = await usersCollection();
  const dmCol = await dmChannelsCollection();

  // 對方存在且不是 deleted
  const otherUser = await userCol.findOne({
    _id: otherUserId,
    accountStatus: { $ne: "deleted" },
  });

  if (!otherUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const now = new Date();

  // 先找有沒有已存在的 DM channel
  let dmDoc = await dmCol.findOne({
    userIds: { $all: [currentUserId, otherUserId] },
  });

  if (!dmDoc) {
    const insertResult = await dmCol.insertOne({
      userIds: [currentUserId, otherUserId],
      createdAt: now,
      updatedAt: now,
      lastMessageText: "",
    });

    dmDoc = {
      _id: insertResult.insertedId,
      userIds: [currentUserId, otherUserId],
      createdAt: now,
      updatedAt: now,
      lastMessageText: "",
    };
  } else {
    // 更新 updatedAt
    await dmCol.updateOne(
      { _id: dmDoc._id },
      { $set: { updatedAt: now } }
    );
  }

  // 回傳 sidebar 需要的 DM 資訊
  const dm = {
    userId: otherUserId.toString(),
    userName: otherUser.name ?? otherUser.email ?? "Unknown",
    userAvatar: otherUser.avatarUrl ?? undefined,
    status: toSidebarStatus(otherUser.status),
    lastMessage: dmDoc.lastMessageText ?? "",
  };

  return NextResponse.json({ dm }, { status: 200 });
}