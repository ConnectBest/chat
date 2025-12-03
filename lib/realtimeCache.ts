import { getRedis } from "./redis";

/* ============== 2.1 User Presence/Status ============== */
/**
 * Key: user:presence:{userId}
 * Type: Hash
 * Fields: status, statusMessage, lastSeen
 * TTL: 5 minutes
 */
export async function setUserPresence(
  userId: string,
  status: "online" | "away" | "busy" | "inmeeting" | "offline",
  statusMessage?: string
) {
  const redis = await getRedis();
  const key = `user:presence:${userId}`;
  const now = Date.now().toString();

  await redis.hSet(key, {
    status,
    statusMessage: statusMessage ?? "",
    lastSeen: now,
  });
  // 5 分鐘 TTL
  await redis.expire(key, 5 * 60);
}

export async function getUserPresence(userId: string) {
  const redis = await getRedis();
  const key = `user:presence:${userId}`;
  const data = await redis.hGetAll(key);
  if (!data || Object.keys(data).length === 0) return null;

  return {
    status: data.status as
      | "online"
      | "away"
      | "busy"
      | "inmeeting"
      | "offline",
    statusMessage: data.statusMessage || "",
    lastSeen: data.lastSeen ? new Date(Number(data.lastSeen)) : null,
  };
}

/* ============== 2.2 Typing Indicators ============== */
/**
 * Key: typing:{channelId}
 * Type: Set (userId)
 * TTL: 5 seconds
 */
export async function addTypingUser(channelId: string, userId: string) {
  const redis = await getRedis();
  const key = `typing:${channelId}`;
  await redis.sAdd(key, userId);
  await redis.expire(key, 5); // 5 秒自動過期
}

export async function removeTypingUser(channelId: string, userId: string) {
  const redis = await getRedis();
  const key = `typing:${channelId}`;
  await redis.sRem(key, userId);
}

export async function getTypingUsers(channelId: string): Promise<string[]> {
  const redis = await getRedis();
  const key = `typing:${channelId}`;
  const members = await redis.sMembers(key);
  return members;
}

/* ============== 2.3 Unread Message Counts ============== */
/**
 * Key: unread:{userId}:{channelId}
 * Type: Integer
 */
export async function incrementUnread(
  userId: string,
  channelId: string,
  amount: number = 1
) {
  const redis = await getRedis();
  const key = `unread:${userId}:${channelId}`;
  await redis.incrBy(key, amount);
}

export async function resetUnread(userId: string, channelId: string) {
  const redis = await getRedis();
  const key = `unread:${userId}:${channelId}`;
  await redis.del(key);
}

export async function getUnreadCount(
  userId: string,
  channelId: string
): Promise<number> {
  const redis = await getRedis();
  const key = `unread:${userId}:${channelId}`;
  const val = await redis.get(key);
  return val ? parseInt(val, 10) : 0;
}

/* ============== 2.4 Rate Limiting ============== */
/**
 * Key: ratelimit:{endpoint}:{userId}
 * Type: Integer
 * TTL: windowSeconds
 *
 * 回傳 true = 允許, false = 超過限制
 */
export async function checkRateLimit(options: {
  endpoint: string;
  userId: string;
  limit: number;        // e.g. 50
  windowSeconds: number; // e.g. 60
}): Promise<boolean> {
  const { endpoint, userId, limit, windowSeconds } = options;
  const redis = await getRedis();
  const key = `ratelimit:${endpoint}:${userId}`;

  // INCR + 順便設定 TTL
  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, windowSeconds);
  }

  return current <= limit;
}

/* ============== 2.5 Active WebSocket Connections ============== */
/**
 * Key: ws:connections:{userId}
 * Type: Set (connection_id)
 */
export async function addWsConnection(userId: string, connectionId: string) {
  const redis = await getRedis();
  const key = `ws:connections:${userId}`;
  await redis.sAdd(key, connectionId);
}

export async function removeWsConnection(userId: string, connectionId: string) {
  const redis = await getRedis();
  const key = `ws:connections:${userId}`;
  await redis.sRem(key, connectionId);
}

export async function getWsConnections(userId: string): Promise<string[]> {
  const redis = await getRedis();
  const key = `ws:connections:${userId}`;
  return redis.sMembers(key);
}

/* ============== 2.6 Channel Online Users ============== */
/**
 * Key: channel:online:{channelId}
 * Type: Set (userId)
 */
export async function addChannelOnlineUser(
  channelId: string,
  userId: string
) {
  const redis = await getRedis();
  const key = `channel:online:${channelId}`;
  await redis.sAdd(key, userId);
}

export async function removeChannelOnlineUser(
  channelId: string,
  userId: string
) {
  const redis = await getRedis();
  const key = `channel:online:${channelId}`;
  await redis.sRem(key, userId);
}

export async function getChannelOnlineUsers(
  channelId: string
): Promise<string[]> {
  const redis = await getRedis();
  const key = `channel:online:${channelId}`;
  return redis.sMembers(key);
}

/* ============== 2.7 Session Cache ============== */
/**
 * Key: session:{tokenHash}
 * Type: Hash
 * Fields: userId, role, expiresAt
 * TTL: 跟 JWT 一樣
 */
export async function cacheSession(options: {
  tokenHash: string;
  userId: string;
  role: string;
  expiresAt: number; // timestamp (ms)
  ttlSeconds: number;
}) {
  const { tokenHash, userId, role, expiresAt, ttlSeconds } = options;
  const redis = await getRedis();
  const key = `session:${tokenHash}`;

  await redis.hSet(key, {
    userId,
    role,
    expiresAt: expiresAt.toString(),
  });
  await redis.expire(key, ttlSeconds);
}

export async function getCachedSession(tokenHash: string) {
  const redis = await getRedis();
  const key = `session:${tokenHash}`;
  const data = await redis.hGetAll(key);
  if (!data || Object.keys(data).length === 0) return null;

  return {
    userId: data.userId,
    role: data.role,
    expiresAt: data.expiresAt ? Number(data.expiresAt) : null,
  };
}

export async function removeCachedSession(tokenHash: string) {
  const redis = await getRedis();
  const key = `session:${tokenHash}`;
  await redis.del(key);
}

/* ============== 2.8 Message Cache (Recent Messages) ============== */
/**
 * Key: messages:recent:{channelId}
 * Type: List (JSON string)
 * Max Length: 100
 * TTL: 1 hour
 */
export interface CachedMessage {
  id: string;
  userId: string;
  content: string;
  createdAt: string; // ISO string for cache
}

const RECENT_MESSAGES_LIMIT = 100;
const RECENT_MESSAGES_TTL_SECONDS = 60 * 60;

export async function cacheRecentMessages(
  channelId: string,
  messages: CachedMessage[]
) {
  const redis = await getRedis();
  const key = `messages:recent:${channelId}`;

  if (messages.length === 0) return;

  // 用 LPUSH + LTRIM，只保留最新 100 筆
  const pipeline = redis.multi();
  for (const msg of messages) {
    pipeline.lPush(key, JSON.stringify(msg));
  }
  pipeline.lTrim(key, 0, RECENT_MESSAGES_LIMIT - 1);
  pipeline.expire(key, RECENT_MESSAGES_TTL_SECONDS);
  await pipeline.exec();
}

export async function addRecentMessage(
  channelId: string,
  message: CachedMessage
) {
  const redis = await getRedis();
  const key = `messages:recent:${channelId}`;

  const pipeline = redis.multi();
  pipeline.lPush(key, JSON.stringify(message));
  pipeline.lTrim(key, 0, RECENT_MESSAGES_LIMIT - 1);
  pipeline.expire(key, RECENT_MESSAGES_TTL_SECONDS);
  await pipeline.exec();
}

export async function getRecentMessages(
  channelId: string,
  limit: number = 50
): Promise<CachedMessage[]> {
  const redis = await getRedis();
  const key = `messages:recent:${channelId}`;
  const raw = await redis.lRange(key, 0, limit - 1);
  return raw.map((s) => JSON.parse(s) as CachedMessage);
}