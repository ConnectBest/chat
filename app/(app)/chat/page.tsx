import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { channelsCollection } from "@/lib/database";
import { ObjectId } from "mongodb";

export default async function ChatRootPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const col = await channelsCollection();

  // 1) 找第一個「未被刪除」的 channel
  let firstChannel: any = await col
    .find({ isDeleted: { $ne: true } })
    .sort({ createdAt: 1 })
    .limit(1)
    .next();

  // 2) 如果目前沒有任何啟用中的 channel
  if (!firstChannel) {
    const now = new Date();

    // 2-1) 先看看 DB 裡有沒有舊的 "general"（包含 isDeleted: true 的）
    const existingGeneral = await col.findOne({ name: "general" });

    if (existingGeneral) {
      // 有舊的 general，就把它復活
      if (existingGeneral.isDeleted) {
        await col.updateOne(
          { _id: existingGeneral._id },
          {
            $set: {
              isDeleted: false,
              deletedAt: undefined,
              updatedAt: now,
            },
          }
        );
      }

      firstChannel = {
        ...existingGeneral,
        isDeleted: false,
        deletedAt: undefined,
        updatedAt: now,
      };
    } else {
      // 2-2) DB 完全沒有 general，才真的 insert 一個新的
      const doc = {
        name: "general",
        description: "General discussion",
        type: "public" as const,
        createdBy: new ObjectId(session.user.id as string),
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: undefined as Date | undefined,
      };

      const insertResult = await col.insertOne(doc as any);

      firstChannel = {
        _id: insertResult.insertedId,
        ...doc,
      };
    }
  }

  // 3) 導向 /chat/[channelId]
  redirect(`/chat/${firstChannel._id.toString()}`);
}