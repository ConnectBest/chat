import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { usersCollection } from "@/lib/database";

interface RouteContext {
  params: { id: string };
}

/*
取得單一使用者資料
對應前端 api.getUserById(userId) -> { user: UserDTO }
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const col = await usersCollection();

  const doc = await col.findOne({
    _id: new ObjectId(id),
    accountStatus: { $ne: "deleted" },
  });

  if (!doc) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const user = {
    id: doc._id.toString(),
    name: doc.name ?? doc.email ?? "Unknown User",
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
  };

  return NextResponse.json({ user }, { status: 200 });
}