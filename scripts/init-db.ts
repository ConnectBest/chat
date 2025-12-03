import { MongoClient, Db } from "mongodb";
import dotenv from "dotenv";

// 讀 chat/.env（從專案根目錄執行 `npm run init:db` 時會載入這個）
dotenv.config();

const uri = process.env.MONGODB_URI!;
const dbName = process.env.MONGODB_DB || "connectbest-chat";

if (!uri) {
  throw new Error("MONGODB_URI is not set in .env");
}

async function setupUsers(db: Db) {
  const users = db.collection("users");
  await users.createIndex({ email: 1 }, { unique: true });
  await users.createIndex({ googleId: 1 }, { unique: true, sparse: true });
  await users.createIndex({ status: 1 });
  await users.createIndex({ createdAt: -1 });
  await users.createIndex({ email: "text", name: "text" });
}

async function setupChannels(db: Db) {
  const channels = db.collection("channels");
  await channels.createIndex({ name: 1 }, { unique: true });
  await channels.createIndex({ type: 1 });
  await channels.createIndex({ createdBy: 1 });
  await channels.createIndex({ createdAt: -1 });
}

async function setupChannelMembers(db: Db) {
  const channelMembers = db.collection("channelMembers");
  await channelMembers.createIndex(
    { channelId: 1, userId: 1 },
    { unique: true }
  );
  await channelMembers.createIndex({ channelId: 1 });
  await channelMembers.createIndex({ userId: 1 });
  await channelMembers.createIndex({ lastReadAt: -1 });
}

async function setupMessages(db: Db) {
  const messages = db.collection("messages");
  await messages.createIndex({ channelId: 1, createdAt: -1 });
  await messages.createIndex({ userId: 1 });
  await messages.createIndex({ parentMessageId: 1 });
  await messages.createIndex({ scheduledFor: 1 }, { sparse: true });
  await messages.createIndex({ content: "text" });
  await messages.createIndex({ "metadata.mentions": 1 });
}

async function setupMessageReactions(db: Db) {
  const reactions = db.collection("messageReactions");
  await reactions.createIndex(
    { messageId: 1, userId: 1 },
    { unique: true }
  );
  await reactions.createIndex({ messageId: 1 });
  await reactions.createIndex({ userId: 1 });
}

async function setupAttachments(db: Db) {
  const attachments = db.collection("attachments");
  await attachments.createIndex({ messageId: 1 });
  await attachments.createIndex({ uploaderId: 1 });
  await attachments.createIndex({ expiresAt: 1 }, { sparse: true });
  await attachments.createIndex({ uploadedAt: -1 });
}

async function setupVoiceMessages(db: Db) {
  const voice = db.collection("voiceMessages");
  await voice.createIndex({ messageId: 1 });
  await voice.createIndex({ transcription: "text" });
}

async function setupDmChannels(db: Db) {
  const dmChannels = db.collection("dmChannels");
  await dmChannels.createIndex(
    { user1Id: 1, user2Id: 1 },
    { unique: true }
  );
  await dmChannels.createIndex({ user1Id: 1 });
  await dmChannels.createIndex({ user2Id: 1 });
  await dmChannels.createIndex({ channelId: 1 }, { unique: true });
}

async function setupNotifications(db: Db) {
  const notifications = db.collection("notifications");
  await notifications.createIndex({ userId: 1, createdAt: -1 });
  await notifications.createIndex({ userId: 1, isRead: 1 });
  await notifications.createIndex({ createdAt: -1 });
}

async function setupHuddles(db: Db) {
  const huddles = db.collection("huddles");
  await huddles.createIndex(
    { channelId: 1, status: 1 },
    {
      unique: true,
      partialFilterExpression: { status: "active" },
    }
  );
  await huddles.createIndex({ status: 1 });
  await huddles.createIndex({ startedAt: -1 });
}

async function setupHuddleParticipants(db: Db) {
  const huddleParticipants = db.collection("huddleParticipants");
  await huddleParticipants.createIndex({ huddleId: 1, userId: 1 });
  await huddleParticipants.createIndex({ huddleId: 1 });
  await huddleParticipants.createIndex({ userId: 1 });
}

async function setupCanvasDocuments(db: Db) {
  const docs = db.collection("canvasDocuments");
  await docs.createIndex({ channelId: 1 });
  await docs.createIndex({ createdBy: 1 });
  await docs.createIndex({ lastEditedAt: -1 });
  await docs.createIndex({ content: "text" });
}

async function setupCanvasDocumentVersions(db: Db) {
  const versions = db.collection("canvasDocumentVersions");
  await versions.createIndex(
    { documentId: 1, version: 1 },
    { unique: true }
  );
  await versions.createIndex({ documentId: 1 });
  await versions.createIndex({ createdAt: -1 });
}

async function setupClips(db: Db) {
  const clips = db.collection("clips");
  await clips.createIndex({ channelId: 1 });
  await clips.createIndex({ uploadedBy: 1 });
  await clips.createIndex({ createdAt: -1 });
  await clips.createIndex({ expiresAt: 1 }, { sparse: true });
}

async function setupCalls(db: Db) {
  const calls = db.collection("calls");
  await calls.createIndex({ channelId: 1 });
  await calls.createIndex({ dmChannelId: 1 });
  await calls.createIndex({ startedBy: 1 });
  await calls.createIndex({ status: 1 });
  await calls.createIndex({ startedAt: -1 });
}

async function setupCallParticipants(db: Db) {
  const callParticipants = db.collection("callParticipants");
  await callParticipants.createIndex({ callId: 1 });
  await callParticipants.createIndex({ userId: 1 });
  await callParticipants.createIndex({ callId: 1, userId: 1 });
}

async function setupScheduledMessages(db: Db) {
  const scheduled = db.collection("scheduledMessages");
  await scheduled.createIndex({ channelId: 1 });
  await scheduled.createIndex({ userId: 1 });
  await scheduled.createIndex({ scheduledFor: 1 });
  await scheduled.createIndex({ status: 1 });
}

async function setupAiPrompts(db: Db) {
  const aiPrompts = db.collection("aiPrompts");
  await aiPrompts.createIndex({ userId: 1, createdAt: -1 });
  await aiPrompts.createIndex({ createdAt: -1 });
  await aiPrompts.createIndex({ model: 1 });
}

async function setupSessions(db: Db) {
  const sessions = db.collection("sessions");
  await sessions.createIndex({ userId: 1 });
  await sessions.createIndex({ tokenHash: 1 }, { unique: true });
  // TTL：expiresAt 到期就自動刪除
  await sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}

async function setupAuditLogs(db: Db) {
  const auditLogs = db.collection("auditLogs");
  await auditLogs.createIndex({ userId: 1, createdAt: -1 });
  await auditLogs.createIndex({ action: 1 });
  await auditLogs.createIndex({ entityType: 1, entityId: 1 });
  await auditLogs.createIndex({ createdAt: -1 });
  // TTL：audit log 保留 1 年
  await auditLogs.createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: 31536000 } // 1 year
  );
}

async function init() {
  console.log("Connecting to MongoDB...");
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);

  console.log(`Using database: ${dbName}`);

  await setupUsers(db);
  await setupChannels(db);
  await setupChannelMembers(db);
  await setupMessages(db);
  await setupMessageReactions(db);
  await setupAttachments(db);
  await setupVoiceMessages(db);
  await setupDmChannels(db);
  await setupNotifications(db);
  await setupHuddles(db);
  await setupHuddleParticipants(db);
  await setupCanvasDocuments(db);
  await setupCanvasDocumentVersions(db);
  await setupClips(db);
  await setupCalls(db);
  await setupCallParticipants(db);
  await setupScheduledMessages(db);
  await setupAiPrompts(db);
  await setupSessions(db);
  await setupAuditLogs(db);

  console.log("✅ All collections & indexes (including TTL) are set up.");
  await client.close();
}

init().catch((err) => {
  console.error("❌ init-db failed:", err);
  process.exit(1);
});