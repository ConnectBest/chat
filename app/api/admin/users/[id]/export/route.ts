import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/database";

export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const { id } = context.params; // ✅ 不用 await

  const db = await getDb();
  const userId = new ObjectId(id);

  const user = await db.collection("users").findOne({ _id: userId });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const messages = await db
    .collection("messages")
    .find({ userId })
    .toArray();

  const channels = await db
    .collection("channelMembers")
    .find({ userId })
    .toArray();

  return NextResponse.json(
    {
      user,
      messages,
      channels,
      exportedAt: new Date(),
    },
    { status: 200 }
  );
}