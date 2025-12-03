import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { usersCollection } from "@/lib/database";

/*
 * GET /api/users/list?q=keyword
 * 回傳可以用來開始 DM 的使用者清單（排除自己）
 * 對應前端：api.listUsers({ q? }) -> { users: UserDTO[] }
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUserId = session.user.id as string;

  if (!ObjectId.isValid(currentUserId)) {
    return NextResponse.json(
      { error: "Invalid current user id" },
      { status: 400 }
    );
  }

  const col = await usersCollection();

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";

  const filter: any = {
    _id: { $ne: new ObjectId(currentUserId) },
    accountStatus: { $ne: "deleted" }, // 排除已刪除帳號
  };

  if (q) {
    // name 或 email 部分比對
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } },
    ];
  }

  try {
    const docs = await col
      .find(filter)
      .sort({ name: 1 })
      .limit(100)
      .toArray();

    const users = docs.map((doc) => ({
      id: doc._id.toString(),
      name: doc.name ?? doc.email ?? "Unknown",
      email: doc.email,
      phone: doc.phone ?? undefined,
      status:
        doc.status === "online" ||
        doc.status === "away" ||
        doc.status === "busy" ||
        doc.status === "inmeeting" ||
        doc.status === "offline"
          ? doc.status
          : ("offline" as const),
      statusMessage: doc.statusMessage ?? undefined,
      avatarUrl: doc.avatarUrl ?? undefined,
    }));

    return NextResponse.json({ users }, { status: 200 });
  } catch (err) {
    console.error("[GET /api/users/list] error:", err);
    return NextResponse.json(
      { error: "Failed to load users" },
      { status: 500 }
    );
  }
}