// suspend / activate
import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { usersCollection } from "@/lib/database";

interface RouteContext {
  params: Promise<{ id: string }>; // Next 15：params 是 Promise
}

export async function POST(req: NextRequest, context: RouteContext) {
  // 一樣先檢查登入
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const action = body?.action as "suspend" | "activate" | undefined;

  if (!action || !["suspend", "activate"].includes(action)) {
    return NextResponse.json(
      { error: "Invalid action, expected 'suspend' or 'activate'" },
      { status: 400 }
    );
  }

  const col = await usersCollection();
  const userId = new ObjectId(id);
  const now = new Date();

  const accountStatus = action === "suspend" ? "suspended" : "active";

  const result = await col.updateOne(
    { _id: userId },
    {
      $set: {
        accountStatus,
        updatedAt: now,
      },
    }
  );

  if (!result.matchedCount) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      success: true,
      accountStatus,
    },
    { status: 200 }
  );
}