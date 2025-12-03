import { ObjectId } from "mongodb";
import { messagesCollection } from "./database";
import type { MessageDocument } from "./database";

// 回傳給前端的精簡 message 型別（只包含常用欄位）
export type PublicMessage = Pick<
  MessageDocument,
  "_id" | "channelId" | "userId" | "content" | "createdAt"
>;

export interface PaginatedMessagesResult {
  messages: PublicMessage[];
  nextCursor: string | null; // 下一頁要用的 _id（字串版）
}

/**
 * 取得某 channel 最新的 messages（第一頁）
 * 使用 projection + sort + limit，符合 spec 裡的最佳化建議
 */
export async function getLatestMessagesForChannel(
  channelId: string,
  limit = 50
): Promise<PaginatedMessagesResult> {
  const col = await messagesCollection();

  const query = {
    channelId: new ObjectId(channelId),
  };

  const cursor = col.find(query, {
    projection: {
      // 只取需要的欄位（projection）
      content: 1,
      userId: 1,
      channelId: 1,
      createdAt: 1,
    },
    sort: { _id: -1 }, // 最新的在前面，用 _id 搭配 index
    limit,
  });

  const docs = (await cursor.toArray()) as PublicMessage[];

  // cursor-based pagination：用最後一筆的 _id 當下一頁游標
  const nextCursor =
    docs.length === limit ? docs[docs.length - 1]._id.toString() : null;

  return { messages: docs, nextCursor };
}

/**
 * 取得「游標之前」的 messages（第二頁、第三頁...）
 * 對應 spec 裡的 cursor-based pagination 範例
 */
export async function getMessagesBeforeCursor(
  channelId: string,
  lastSeenId: string,
  limit = 50
): Promise<PaginatedMessagesResult> {
  const col = await messagesCollection();

  const query = {
    channelId: new ObjectId(channelId),
    _id: { $lt: new ObjectId(lastSeenId) }, // 只拿比游標小的 _id
  };

  const cursor = col.find(query, {
    projection: {
      content: 1,
      userId: 1,
      channelId: 1,
      createdAt: 1,
    },
    sort: { _id: -1 },
    limit,
  });

  const docs = (await cursor.toArray()) as PublicMessage[];

  const nextCursor =
    docs.length === limit ? docs[docs.length - 1]._id.toString() : null;

  return { messages: docs, nextCursor };
}