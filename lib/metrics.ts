import { getDb } from "./database";
import { ObjectId } from "mongodb";

/**
 * 5.1 User Metrics
 * - Daily Active Users（最近 24h 有 lastSeen 的 user 數量）
 * - Messages per user（最近 24h，每個 user 的訊息數 Top 10）
 */
export async function getUserMetrics() {
  const db = await getDb();
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Daily Active Users
  const [{ dailyActiveUsers } = { dailyActiveUsers: 0 }] = await db
    .collection("users")
    .aggregate<{ dailyActiveUsers: number }>([
      {
        $match: {
          lastSeen: { $gte: last24h },
        },
      },
      {
        $count: "dailyActiveUsers",
      },
    ])
    .toArray();

  // Messages per user (Top 10)
  const messagesPerUser = await db
    .collection("messages")
    .aggregate<
      { _id: ObjectId | null; messageCount: number; user?: any }
    >([
      {
        $match: {
          createdAt: { $gte: last24h },
          isDeleted: { $ne: true },
        },
      },
      {
        $group: {
          _id: "$userId",
          messageCount: { $sum: 1 },
        },
      },
      { $sort: { messageCount: -1 } },
      { $limit: 10 },
      // 連到 users 拿名稱
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: {
          path: "$user",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          userId: "$_id",
          messageCount: 1,
          name: "$user.name",
          email: "$user.email",
        },
      },
    ])
    .toArray();

  return {
    dailyActiveUsers,
    messagesPerUser,
  };
}

/**
 * 5.2 Channel Metrics
 * - Most active channels (最近 7 天訊息最多的前 10 個 channel)
 */
export async function getChannelMetrics() {
  const db = await getDb();
  const now = new Date();
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const mostActiveChannels = await db
    .collection("messages")
    .aggregate<
      { _id: ObjectId | null; messageCount: number; channel?: any }
    >([
      {
        $match: {
          createdAt: { $gte: last7d },
          isDeleted: { $ne: true },
        },
      },
      {
        $group: {
          _id: "$channelId",
          messageCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "channels",
          localField: "_id",
          foreignField: "_id",
          as: "channel",
        },
      },
      {
        $unwind: {
          path: "$channel",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          channelId: "$_id",
          messageCount: 1,
          name: "$channel.name",
          type: "$channel.type",
        },
      },
      { $sort: { messageCount: -1 } },
      { $limit: 10 },
    ])
    .toArray();

  return {
    mostActiveChannels,
  };
}

/**
 * 5.5 AI Metrics
 * - 最近 30 天 AI 使用狀況
 */
export async function getAiMetrics() {
  const db = await getDb();
  const now = new Date();
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [stats = { totalPrompts: 0, totalTokens: 0, avgProcessingTime: 0 }] =
    await db
      .collection("aiPrompts")
      .aggregate<{
        totalPrompts: number;
        totalTokens: number;
        avgProcessingTime: number;
      }>([
        {
          $match: {
            createdAt: { $gte: last30d },
          },
        },
        {
          $group: {
            _id: null,
            totalPrompts: { $sum: 1 },
            totalTokens: { $sum: "$tokensUsed" },
            avgProcessingTime: { $avg: "$processingTime" },
          },
        },
        {
          $project: {
            _id: 0,
            totalPrompts: 1,
            totalTokens: 1,
            avgProcessingTime: 1,
          },
        },
      ])
      .toArray();

  return stats;
}

/**
 * 综合所有 metrics，給 admin dashboard 使用
 */
export async function getAllMetrics() {
  const [userMetrics, channelMetrics, aiMetrics] = await Promise.all([
    getUserMetrics(),
    getChannelMetrics(),
    getAiMetrics(),
  ]);

  return {
    user: userMetrics,
    channel: channelMetrics,
    ai: aiMetrics,
  };
}