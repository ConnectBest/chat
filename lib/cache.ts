import { ObjectId } from "mongodb";
import { getRedis } from "./redis";
import { usersCollection, messagesCollection } from "./database";
import type { UserDocument, MessageDocument } from "./database";

/**
 * 取得使用者資料（有 Redis 快取）
 * 對應 spec: "Cache user profiles"
 */
export async function getUserProfileCached(
  userId: string
): Promise<UserDocument | null> {
  const redis = await getRedis();
  const cacheKey = `user:${userId}`;

  // 1) 先查 Redis
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as UserDocument;
  }

  // 2) 沒有的話查 MongoDB
  const users = await usersCollection();
  const user = await users.findOne({ _id: new ObjectId(userId) });
  if (!user) return null;

  // 3) 寫回 Redis，存 5 分鐘（300 秒）
  await redis.set(cacheKey, JSON.stringify(user), {
    EX: 300,
  });

  return user;
}

/**
 * 取得某 channel 的最近 messages（有 Redis 快取）
 * 對應 spec: "Message Cache (Recent Messages)"
 */
export async function getRecentMessagesCached(
  channelId: string,
  limit = 50
): Promise<MessageDocument[]> {
  const redis = await getRedis();
  const cacheKey = `messages:recent:${channelId}`;

  // 1) 先從 Redis 的 list 讀
  const items = await redis.lRange(cacheKey, 0, limit - 1);
  if (items.length > 0) {
    return items.map((m) => JSON.parse(m) as MessageDocument);
  }

  // 2) 沒有快取時，從 MongoDB 查詢
  const messagesCol = await messagesCollection();
  const messages = await messagesCol
    .find(
      { channelId: new ObjectId(channelId) },
      {
        sort: { createdAt: -1 },
        limit,
      }
    )
    .toArray();

  if (messages.length === 0) {
    return [];
  }

  // 3) 寫回 Redis，使用 pipeline 批次寫入 + 設定 TTL
  const pipeline = redis.multi();
  for (const msg of messages) {
    pipeline.rPush(cacheKey, JSON.stringify(msg));
  }
  pipeline.expire(cacheKey, 3600); // 1 小時
  await pipeline.exec();

  return messages as MessageDocument[];
}