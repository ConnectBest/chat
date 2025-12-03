import {
  MongoClient,
  Db,
  Collection,
  ObjectId,
} from "mongodb";

/* ==========================
 * User 型別
 * ========================== */

export type UserRole = "admin" | "user";

export type UserStatus =
  | "online"
  | "away"
  | "busy"
  | "inmeeting"
  | "offline";

export type UserAccountStatus =
  | "active"
  | "suspended"
  | "deleted";

export interface UserPreferences {
  notifications: boolean; // default: true
  soundEnabled: boolean;  // default: true
  timezone: string;       // default: 'UTC'
}

export interface UserDocument {
  _id: ObjectId;

  email: string;                 // unique, required
  passwordHash?: string | null;  // null for OAuth-only users
  name: string;                  // required
  phone?: string;

  role: UserRole;                // 'admin' | 'user'
  status: UserStatus;            // presence status
  statusMessage?: string;
  avatarUrl?: string;

  emailVerified: boolean;        // default: false
  verificationToken?: string;
  verificationExpires?: Date;
  resetToken?: string;
  resetExpires?: Date;

  twoFAEnabled: boolean;         // default: false
  twoFASecret?: string;

  googleId?: string;             // unique, sparse
  lastLogin?: Date;
  lastSeen?: Date;

  accountStatus: UserAccountStatus; // 'active' | 'suspended' | 'deleted'
  suspensionReason?: string;

  preferences: UserPreferences;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

/* ==========================
 * Channel 型別 (README 1.2)
 * ========================== */

export type ChannelType = "public" | "private" | "dm";

export interface ChannelDocument {
  _id: ObjectId;
  name: string;           // unique, required
  description?: string;
  type: ChannelType;      // 'public' | 'private' | 'dm'
  createdBy: ObjectId;    // ref: users
  isDeleted: boolean;     // default: false
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

/* ==========================
 * DM Channel 型別
 * ========================== */

export interface DmChannelDocument {
  _id?: ObjectId;
  userIds: ObjectId[];        // 兩個使用者的 _id
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  lastMessageText?: string;   // 選填：最後一則訊息摘要（之後可用）
}

/**
 * dmChannels collection
 */
export async function dmChannelsCollection(): Promise<Collection<DmChannelDocument>> {
  const db = await getDb();
  return db.collection<DmChannelDocument>("dmChannels");
}

/* ==========================
 * Message 型別 (README 1.4)
 * ========================== */

export type MessageStatus =
  | "pending"
  | "sent"
  | "failed"
  | "scheduled";

export interface MessageLinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
}

export interface MessageMetadata {
  mentions?: ObjectId[];          // user IDs
  linkPreview?: MessageLinkPreview;
}

export interface MessageDocument {
  _id: ObjectId;
  channelId: ObjectId;            // ref: channels
  userId: ObjectId;               // ref: users
  parentMessageId?: ObjectId;     // for threads
  content: string;                // required

  isPinned: boolean;              // default: false
  isEdited: boolean;              // default: false
  isDeleted: boolean;             // default: false

  editedAt?: Date;
  scheduledFor?: Date;            // for scheduled messages
  status: MessageStatus;          // enum

  metadata?: MessageMetadata;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

/* ==========================
 * Mongo 連線設定
 * ========================== */

const rawUri = process.env.MONGODB_URI;

if (!rawUri) {
  throw new Error("MONGODB_URI is not set in environment variables");
}

const uri: string = rawUri;
const dbName = process.env.MONGODB_DB || "connectbest-chat";

let clientPromise: Promise<MongoClient> | null = null;

/**
 * 取得 Db 實例（整個 app 共用一個 Mongo 連線）
 */
export async function getDb(): Promise<Db> {
  if (!clientPromise) {
    clientPromise = MongoClient.connect(uri);
  }
  const client = await clientPromise;
  return client.db(dbName);
}

/**
 * users collection（帶 UserDocument 型別）
 */
export async function usersCollection(): Promise<Collection<UserDocument>> {
  const db = await getDb();
  return db.collection<UserDocument>("users");
}

/**
 * channels collection（帶 ChannelDocument 型別）
 */
export async function channelsCollection(): Promise<Collection<ChannelDocument>> {
  const db = await getDb();
  return db.collection<ChannelDocument>("channels");
}

/**
 * messages collection（帶 MessageDocument 型別）
 */
export async function messagesCollection(): Promise<Collection<MessageDocument>> {
  const db = await getDb();
  return db.collection<MessageDocument>("messages");
}