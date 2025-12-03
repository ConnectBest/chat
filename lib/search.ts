import { ObjectId } from "mongodb";
import { getDb } from "./database";
import type { MessageDocument, UserDocument } from "./database";

/**
 * 3.1 Messages Full-Text Search（對應 README 的 messages_text_search）
 */
export interface MessageSearchResult {
  message: MessageDocument;
  score: number;
}

export async function searchMessagesText(options: {
  query: string;
  limit?: number;
  channelId?: string; // 可選：只查某個 channel
}) {
  const { query, limit = 20, channelId } = options;
  const db = await getDb();

  const pipeline: any[] = [
    {
      $search: {
        index: "messages_text_search",
        text: {
          query,
          path: "content",
          fuzzy: {
            maxEdits: 2,
          },
        },
      },
    },
    {
      $match: {
        isDeleted: false,
      },
    },
    {
      $project: {
        _id: 1,
        channelId: 1,
        userId: 1,
        content: 1,
        createdAt: 1,
        score: { $meta: "searchScore" },
      },
    },
    { $sort: { score: -1 } },
    { $limit: limit },
  ];

  // 如果有指定 channel，就插一個 $match
  if (channelId) {
    (pipeline[1].$match as any).channelId = new ObjectId(channelId);
  }

  const results = await db
    .collection<MessageDocument>("messages")
    .aggregate(pipeline)
    .toArray();

  return results.map((r: any) => ({
    message: {
      _id: r._id,
      channelId: r.channelId,
      userId: r.userId,
      content: r.content,
      createdAt: r.createdAt,
      // 如果你的 MessageDocument 有更多欄位，可以在這裡補上
    } as MessageDocument,
    score: r.score as number,
  })) as MessageSearchResult[];
}

/**
 * 3.2 Users Full-Text Search（對應 README 的 users_text_search）
 */
export interface UserSearchResult {
  user: UserDocument;
  score: number;
}

export async function searchUsersText(options: {
  query: string;
  limit?: number;
}) {
  const { query, limit = 10 } = options;
  const db = await getDb();

  const pipeline = [
    {
      $search: {
        index: "users_text_search",
        text: {
          query,
          path: ["name", "email"],
          fuzzy: {
            maxEdits: 1,
          },
        },
      },
    },
    {
      $project: {
        _id: 1,
        email: 1,
        name: 1,
        role: 1,
        status: 1,
        avatarUrl: 1,
        score: { $meta: "searchScore" },
      },
    },
    { $sort: { score: -1 } },
    { $limit: limit },
  ];

  const results = await db
    .collection<UserDocument>("users")
    .aggregate(pipeline)
    .toArray();

  return results.map((r: any) => ({
    user: {
      _id: r._id,
      email: r.email,
      name: r.name,
      role: r.role,
      status: r.status,
      avatarUrl: r.avatarUrl,
      // 其他欄位用不到可以不帶
    } as UserDocument,
    score: r.score as number,
  })) as UserSearchResult[];
}