import { getDb } from "./database";
import { ObjectId } from "mongodb";

/**
 * 匯出某個使用者相關的資料：
 * - user document
 * - 該 user 發過的 messages
 * - 該 user 所在的 channelMembers
 */
export async function exportUserData(userId: string) {
  const db = await getDb();
  const _id = new ObjectId(userId);

  const user = await db.collection("users").findOne({ _id });

  const messages = await db
    .collection("messages")
    .find({ userId: _id })
    .toArray();

  const channels = await db
    .collection("channelMembers")
    .find({ userId: _id })
    .toArray();

  return {
    user,
    messages,
    channels,
    exportedAt: new Date(),
  };
}

/**
 * 匿名化 / 偽刪除 user：
 * - users: email 改成 deleted_xxx，name 改成 'Deleted User'，passwordHash 清空，accountStatus=deleted
 * - messages: 保留訊息內容，但 userId 設成 null
 */
export async function anonymizeUser(userId: string) {
  const db = await getDb();
  const _id = new ObjectId(userId);

  // 更新 users collection
  await db.collection("users").updateOne(
    { _id },
    {
      $set: {
        email: `deleted_${userId}@deleted.com`,
        name: "Deleted User",
        passwordHash: null,
        accountStatus: "deleted",
        deletedAt: new Date(),
      },
    }
  );

  // 將該 user 發過的訊息匿名化
  await db.collection("messages").updateMany(
    { userId: _id },
    {
      $set: { userId: null },
    }
  );
}