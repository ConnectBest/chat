import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { usersCollection } from "@/lib/database";

export async function POST(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const { id } = context.params;

  const users = await usersCollection();

  const result = await users.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        email: `deleted_${id}@deleted.com`,
        name: "Deleted User",
        passwordHash: null,
        deletedAt: new Date(),
        accountStatus: "deleted",
      },
    }
  );

  if (!result.matchedCount) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}