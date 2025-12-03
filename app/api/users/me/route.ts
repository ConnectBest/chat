import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { usersCollection } from "@/lib/database";
import { ObjectId } from "mongodb";

// 小工具：把 presence 狀態 ↔ profile 顯示文字做映射
function presenceToProfileStatus(status: string | undefined): string {
  switch (status) {
    case "busy":
      return "Busy";
    case "away":
      return "Away";
    case "offline":
      return "Offline";
    case "online":
    case "inmeeting":
    default:
      return "Available";
  }
}

function profileStatusToPresence(status: string | undefined): "online" | "away" | "busy" | "offline" {
  switch (status) {
    case "Busy":
      return "busy";
    case "Away":
      return "away";
    case "Offline":
      return "offline";
    case "Available":
    default:
      return "online";
  }
}

/**
 * GET /api/users/me
 * 回傳目前登入 user 的 profile
 */
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id as string;

  try {
    const col = await usersCollection();
    const doc = await col.findOne({ _id: new ObjectId(userId) });

    if (!doc) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const profileStatus = presenceToProfileStatus(doc.status);

    return NextResponse.json(
      {
        user: {
          id: doc._id.toString(),
          email: doc.email,
          name: doc.name,
          displayName: doc.name, // 目前先跟 name 一樣
          status: profileStatus, // 用於 Profile dropdown: Available/Busy/...
          avatarUrl: doc.avatarUrl ?? null,
          role: doc.role,
          phone: doc.phone ?? null,
          emailVerified: doc.emailVerified,
          // 如果前端之後要用，可以再加 preferences 等欄位
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/users/me] error:", err);
    return NextResponse.json(
      { error: "Failed to load profile" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/users/me
 * body: { name?: string; status?: "Available" | "Busy" | "Away" | "Offline"; avatarUrl?: string }
 */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id as string;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name: string | undefined =
    typeof body.name === "string" ? body.name.trim() : undefined;
  const statusText: string | undefined =
    typeof body.status === "string" ? body.status : undefined;
  const avatarUrl: string | undefined =
    typeof body.avatarUrl === "string" ? body.avatarUrl.trim() : undefined;

  try {
    const col = await usersCollection();
    const existing = await col.findOne({ _id: new ObjectId(userId) });

    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updates: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined && name.length > 0) {
      updates.name = name;
    }

    if (avatarUrl !== undefined) {
      updates.avatarUrl = avatarUrl || undefined;
    }

    if (statusText !== undefined) {
      const presence = profileStatusToPresence(statusText);
      updates.status = presence;          // UserStatus enum
      updates.statusMessage = statusText; // 顯示文字：Available / Busy / ...
    }

    if (Object.keys(updates).length > 1) {
      // 有實際欄位要更新才打 DB（除了 updatedAt）
      await col.updateOne(
        { _id: new ObjectId(userId) },
        { $set: updates }
      );
    }

    // 回傳更新後的 user（簡單做法：合併 existing + updates）
    const merged = { ...existing, ...updates };

    const profileStatus = presenceToProfileStatus(merged.status);

    return NextResponse.json(
      {
        user: {
          id: merged._id.toString(),
          email: merged.email,
          name: merged.name,
          displayName: merged.name,
          status: profileStatus,
          avatarUrl: merged.avatarUrl ?? null,
          role: merged.role,
          phone: merged.phone ?? null,
          emailVerified: merged.emailVerified,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[PUT /api/users/me] error:", err);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}