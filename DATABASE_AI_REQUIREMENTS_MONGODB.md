# Database Schema & AI/ML Requirements - ConnectBest Chat Application (MongoDB)

## 📋 Overview
This document provides comprehensive MongoDB database schema design and AI/ML integration requirements for the ConnectBest Chat application backend team using MongoDB as the database.

---

## 🗄️ 1. DATABASE SCHEMA (MongoDB)

### 1.1 Users Collection
```javascript
{
  _id: ObjectId,
  email: String, // unique, required
  passwordHash: String, // null for OAuth-only users
  name: String, // required
  phone: String,
  role: String, // enum: ['admin', 'user'], default: 'user'
  status: String, // enum: ['online', 'away', 'busy', 'inmeeting', 'offline'], default: 'offline'
  statusMessage: String,
  avatarUrl: String,
  emailVerified: Boolean, // default: false
  verificationToken: String,
  verificationExpires: Date,
  resetToken: String,
  resetExpires: Date,
  twoFAEnabled: Boolean, // default: false
  twoFASecret: String,
  googleId: String, // unique, sparse
  lastLogin: Date,
  lastSeen: Date,
  accountStatus: String, // enum: ['active', 'suspended', 'deleted'], default: 'active'
  suspensionReason: String,
  preferences: {
    notifications: Boolean, // default: true
    soundEnabled: Boolean, // default: true
    timezone: String // default: 'UTC'
  },
  createdAt: Date, // default: Date.now
  updatedAt: Date, // default: Date.now
  deletedAt: Date
}

// Indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ googleId: 1 }, { unique: true, sparse: true });
db.users.createIndex({ status: 1 });
db.users.createIndex({ createdAt: -1 });
db.users.createIndex({ email: "text", name: "text" }); // Text search
```

---

### 1.2 Channels Collection
```javascript
{
  _id: ObjectId,
  name: String, // unique, required
  description: String,
  type: String, // enum: ['public', 'private', 'dm'], default: 'public'
  createdBy: ObjectId, // ref: 'users'
  isDeleted: Boolean, // default: false
  createdAt: Date, // default: Date.now
  updatedAt: Date, // default: Date.now
  deletedAt: Date
}

// Indexes
db.channels.createIndex({ name: 1 }, { unique: true });
db.channels.createIndex({ type: 1 });
db.channels.createIndex({ createdBy: 1 });
db.channels.createIndex({ createdAt: -1 });
```

---

### 1.3 Channel Members Collection
```javascript
{
  _id: ObjectId,
  channelId: ObjectId, // ref: 'channels', required
  userId: ObjectId, // ref: 'users', required
  role: String, // enum: ['admin', 'member'], default: 'member'
  joinedAt: Date, // default: Date.now
  lastReadAt: Date // default: Date.now
}

// Indexes
db.channelMembers.createIndex({ channelId: 1, userId: 1 }, { unique: true });
db.channelMembers.createIndex({ channelId: 1 });
db.channelMembers.createIndex({ userId: 1 });
db.channelMembers.createIndex({ lastReadAt: -1 });
```

---

### 1.4 Messages Collection
```javascript
{
  _id: ObjectId,
  channelId: ObjectId, // ref: 'channels', required
  userId: ObjectId, // ref: 'users', required
  parentMessageId: ObjectId, // ref: 'messages', for threads
  content: String, // required
  isPinned: Boolean, // default: false
  isEdited: Boolean, // default: false
  isDeleted: Boolean, // default: false
  editedAt: Date,
  scheduledFor: Date, // for scheduled messages
  status: String, // enum: ['pending', 'sent', 'failed', 'scheduled'], default: 'sent'
  metadata: {
    mentions: [ObjectId], // array of user IDs
    linkPreview: {
      url: String,
      title: String,
      description: String,
      image: String
    }
  },
  createdAt: Date, // default: Date.now
  updatedAt: Date, // default: Date.now
  deletedAt: Date
}

// Indexes
db.messages.createIndex({ channelId: 1, createdAt: -1 });
db.messages.createIndex({ userId: 1 });
db.messages.createIndex({ parentMessageId: 1 });
db.messages.createIndex({ scheduledFor: 1 }, { sparse: true });
db.messages.createIndex({ content: "text" }); // Full-text search
db.messages.createIndex({ "metadata.mentions": 1 });
```

---

### 1.5 Message Reactions Collection
```javascript
{
  _id: ObjectId,
  messageId: ObjectId, // ref: 'messages', required
  userId: ObjectId, // ref: 'users', required
  emoji: String, // required, max 10 chars
  createdAt: Date // default: Date.now
}

// Indexes
db.messageReactions.createIndex({ messageId: 1, userId: 1 }, { unique: true });
db.messageReactions.createIndex({ messageId: 1 });
db.messageReactions.createIndex({ userId: 1 });
```

---

### 1.6 Attachments Collection
```javascript
{
  _id: ObjectId,
  messageId: ObjectId, // ref: 'messages'
  uploaderId: ObjectId, // ref: 'users', required
  filename: String, // required
  originalFilename: String, // required
  fileUrl: String, // required
  thumbnailUrl: String,
  fileSize: Number, // in bytes, required
  mimeType: String, // required
  fileType: String, // enum: ['image', 'video', 'audio', 'document', 'other'], required
  metadata: {
    width: Number, // for images
    height: Number, // for images
    duration: Number, // for audio/video in seconds
    codec: String,
    bitrate: String
  },
  uploadedAt: Date, // default: Date.now
  expiresAt: Date // for cleanup of unused attachments
}

// Indexes
db.attachments.createIndex({ messageId: 1 });
db.attachments.createIndex({ uploaderId: 1 });
db.attachments.createIndex({ expiresAt: 1 }, { sparse: true });
db.attachments.createIndex({ uploadedAt: -1 });
```

---

### 1.7 Voice Messages Collection
```javascript
{
  _id: ObjectId,
  messageId: ObjectId, // ref: 'messages', required
  audioUrl: String, // required
  duration: Number, // in seconds, required
  waveformData: [Number], // array of amplitude values
  transcription: String, // AI-generated
  createdAt: Date // default: Date.now
}

// Indexes
db.voiceMessages.createIndex({ messageId: 1 });
db.voiceMessages.createIndex({ transcription: "text" }); // Full-text search
```

---

### 1.8 DM Channels Collection
```javascript
{
  _id: ObjectId,
  channelId: ObjectId, // ref: 'channels', required
  user1Id: ObjectId, // ref: 'users', required
  user2Id: ObjectId, // ref: 'users', required
  createdAt: Date // default: Date.now
}

// Indexes
db.dmChannels.createIndex({ user1Id: 1, user2Id: 1 }, { unique: true });
db.dmChannels.createIndex({ user1Id: 1 });
db.dmChannels.createIndex({ user2Id: 1 });
db.dmChannels.createIndex({ channelId: 1 }, { unique: true });
```

---

### 1.9 Notifications Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId, // ref: 'users', required
  type: String, // enum: ['mention', 'dm', 'reaction', 'thread_reply', 'system'], required
  title: String, // required
  message: String, // required
  channelId: ObjectId, // ref: 'channels'
  messageId: ObjectId, // ref: 'messages'
  isRead: Boolean, // default: false
  metadata: {
    actorId: ObjectId, // user who triggered the notification
    actorName: String,
    additionalData: Object
  },
  createdAt: Date // default: Date.now
}

// Indexes
db.notifications.createIndex({ userId: 1, createdAt: -1 });
db.notifications.createIndex({ userId: 1, isRead: 1 });
db.notifications.createIndex({ createdAt: -1 });
```

---

### 1.10 Huddles Collection
```javascript
{
  _id: ObjectId,
  channelId: ObjectId, // ref: 'channels', required
  title: String,
  createdBy: ObjectId, // ref: 'users', required
  status: String, // enum: ['active', 'ended'], default: 'active'
  startedAt: Date, // default: Date.now
  endedAt: Date,
  duration: Number // in seconds, calculated when ended
}

// Indexes
db.huddles.createIndex({ channelId: 1, status: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });
db.huddles.createIndex({ status: 1 });
db.huddles.createIndex({ startedAt: -1 });
```

---

### 1.11 Huddle Participants Collection
```javascript
{
  _id: ObjectId,
  huddleId: ObjectId, // ref: 'huddles', required
  userId: ObjectId, // ref: 'users', required
  isMuted: Boolean, // default: false
  isDeafened: Boolean, // default: false
  joinedAt: Date, // default: Date.now
  leftAt: Date
}

// Indexes
db.huddleParticipants.createIndex({ huddleId: 1, userId: 1 });
db.huddleParticipants.createIndex({ huddleId: 1 });
db.huddleParticipants.createIndex({ userId: 1 });
```

---

### 1.12 Canvas Documents Collection
```javascript
{
  _id: ObjectId,
  channelId: ObjectId, // ref: 'channels', required
  title: String, // required
  content: String, // Markdown content
  createdBy: ObjectId, // ref: 'users', required
  lastEditedBy: ObjectId, // ref: 'users'
  version: Number, // default: 1
  isDeleted: Boolean, // default: false
  createdAt: Date, // default: Date.now
  lastEditedAt: Date, // default: Date.now
  deletedAt: Date
}

// Indexes
db.canvasDocuments.createIndex({ channelId: 1 });
db.canvasDocuments.createIndex({ createdBy: 1 });
db.canvasDocuments.createIndex({ lastEditedAt: -1 });
db.canvasDocuments.createIndex({ content: "text" }); // Full-text search
```

---

### 1.13 Canvas Document Versions Collection
```javascript
{
  _id: ObjectId,
  documentId: ObjectId, // ref: 'canvasDocuments', required
  version: Number, // required
  content: String, // required
  editedBy: ObjectId, // ref: 'users'
  createdAt: Date // default: Date.now
}

// Indexes
db.canvasDocumentVersions.createIndex({ documentId: 1, version: 1 }, { unique: true });
db.canvasDocumentVersions.createIndex({ documentId: 1 });
db.canvasDocumentVersions.createIndex({ createdAt: -1 });
```

---

### 1.14 Clips Collection
```javascript
{
  _id: ObjectId,
  channelId: ObjectId, // ref: 'channels', required
  uploadedBy: ObjectId, // ref: 'users', required
  title: String,
  type: String, // enum: ['video', 'audio'], required
  videoUrl: String, // required
  thumbnailUrl: String,
  duration: Number, // in seconds, required
  fileSize: Number, // in bytes, required
  metadata: {
    resolution: String, // e.g., "1920x1080"
    codec: String,
    bitrate: String,
    fps: Number
  },
  isDeleted: Boolean, // default: false
  createdAt: Date, // default: Date.now
  expiresAt: Date, // for auto-cleanup
  deletedAt: Date
}

// Indexes
db.clips.createIndex({ channelId: 1 });
db.clips.createIndex({ uploadedBy: 1 });
db.clips.createIndex({ createdAt: -1 });
db.clips.createIndex({ expiresAt: 1 }, { sparse: true });
```

---

### 1.15 Calls Collection
```javascript
{
  _id: ObjectId,
  channelId: ObjectId, // ref: 'channels'
  dmChannelId: ObjectId, // ref: 'dmChannels'
  type: String, // enum: ['audio', 'video', 'screen_share'], required
  startedBy: ObjectId, // ref: 'users', required
  status: String, // enum: ['ringing', 'active', 'ended', 'missed', 'declined'], default: 'active'
  startedAt: Date, // default: Date.now
  endedAt: Date,
  duration: Number // in seconds
}

// Indexes
db.calls.createIndex({ channelId: 1 });
db.calls.createIndex({ dmChannelId: 1 });
db.calls.createIndex({ startedBy: 1 });
db.calls.createIndex({ status: 1 });
db.calls.createIndex({ startedAt: -1 });
```

---

### 1.16 Call Participants Collection
```javascript
{
  _id: ObjectId,
  callId: ObjectId, // ref: 'calls', required
  userId: ObjectId, // ref: 'users', required
  isMuted: Boolean, // default: false
  videoEnabled: Boolean, // default: true
  screenSharing: Boolean, // default: false
  joinedAt: Date, // default: Date.now
  leftAt: Date
}

// Indexes
db.callParticipants.createIndex({ callId: 1 });
db.callParticipants.createIndex({ userId: 1 });
db.callParticipants.createIndex({ callId: 1, userId: 1 });
```

---

### 1.17 Scheduled Messages Collection
```javascript
{
  _id: ObjectId,
  channelId: ObjectId, // ref: 'channels', required
  userId: ObjectId, // ref: 'users', required
  content: String, // required
  scheduledFor: Date, // required
  status: String, // enum: ['pending', 'sent', 'cancelled', 'failed'], default: 'pending'
  sentMessageId: ObjectId, // ref: 'messages'
  attachmentIds: [ObjectId], // array of attachment IDs
  createdAt: Date, // default: Date.now
  sentAt: Date,
  cancelledAt: Date
}

// Indexes
db.scheduledMessages.createIndex({ channelId: 1 });
db.scheduledMessages.createIndex({ userId: 1 });
db.scheduledMessages.createIndex({ scheduledFor: 1 });
db.scheduledMessages.createIndex({ status: 1 });
```

---

### 1.18 AI Prompts Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId, // ref: 'users', required
  channelId: ObjectId, // ref: 'channels'
  prompt: String, // required
  response: String, // required
  model: String, // e.g., "gpt-4", "claude-3", required
  tokensUsed: Number,
  processingTime: Number, // in milliseconds
  context: {
    messageHistory: [Object],
    additionalContext: Object
  },
  createdAt: Date // default: Date.now
}

// Indexes
db.aiPrompts.createIndex({ userId: 1, createdAt: -1 });
db.aiPrompts.createIndex({ createdAt: -1 });
db.aiPrompts.createIndex({ model: 1 });
```

---

### 1.19 Sessions Collection (JWT Token Blacklist)
```javascript
{
  _id: ObjectId,
  userId: ObjectId, // ref: 'users', required
  tokenHash: String, // unique, required
  expiresAt: Date, // required
  isRevoked: Boolean, // default: false
  ipAddress: String,
  userAgent: String,
  createdAt: Date // default: Date.now
}

// Indexes
db.sessions.createIndex({ userId: 1 });
db.sessions.createIndex({ tokenHash: 1 }, { unique: true });
db.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
```

---

### 1.20 Audit Logs Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId, // ref: 'users'
  action: String, // e.g., "user.suspended", "channel.deleted", required
  entityType: String, // e.g., "user", "channel", "message", required
  entityId: ObjectId,
  details: {
    changes: Object,
    reason: String,
    additionalInfo: Object
  },
  ipAddress: String,
  userAgent: String,
  createdAt: Date // default: Date.now
}

// Indexes
db.auditLogs.createIndex({ userId: 1, createdAt: -1 });
db.auditLogs.createIndex({ action: 1 });
db.auditLogs.createIndex({ entityType: 1, entityId: 1 });
db.auditLogs.createIndex({ createdAt: -1 });
db.auditLogs.createIndex({ createdAt: 1 }, { expireAfterSeconds: 31536000 }); // TTL: 1 year
```

---

## 🔴 2. REDIS SCHEMA (Caching & Real-Time)

### 2.1 User Presence/Status
```
Key: user:presence:{userId}
Type: Hash
Fields:
  - status: "online" | "away" | "busy" | "inmeeting" | "offline"
  - statusMessage: string
  - lastSeen: timestamp
TTL: 5 minutes (auto-refresh on activity)
```

### 2.2 Typing Indicators
```
Key: typing:{channelId}
Type: Set
Members: userId
TTL: 5 seconds (auto-expire if not refreshed)
```

### 2.3 Unread Message Counts
```
Key: unread:{userId}:{channelId}
Type: Integer
Value: count of unread messages
No TTL (persist)
```

### 2.4 Rate Limiting
```
Key: ratelimit:{endpoint}:{userId}
Type: Integer
Value: request count
TTL: Based on rate limit window (e.g., 1 minute, 1 hour)
```

### 2.5 Active WebSocket Connections
```
Key: ws:connections:{userId}
Type: Set
Members: connection_id
TTL: None (manual cleanup on disconnect)
```

### 2.6 Channel Online Users
```
Key: channel:online:{channelId}
Type: Set
Members: userId
TTL: None (manual management)
```

### 2.7 Session Cache
```
Key: session:{tokenHash}
Type: Hash
Fields:
  - userId: string
  - role: string
  - expiresAt: timestamp
TTL: Match JWT expiry
```

### 2.8 Message Cache (Recent Messages)
```
Key: messages:recent:{channelId}
Type: List
Members: message JSON objects
Max Length: 100 (keep last 100 messages)
TTL: 1 hour
```

---

## 🔍 3. ELASTICSEARCH/MONGODB ATLAS SEARCH (Full-Text Search)

### 3.1 Messages Search Index
```javascript
// MongoDB Atlas Search Index Definition
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "_id": { "type": "objectId" },
      "channelId": { "type": "objectId" },
      "userId": { "type": "objectId" },
      "content": {
        "type": "string",
        "analyzer": "lucene.english"
      },
      "metadata.mentions": {
        "type": "objectId"
      },
      "isPinned": { "type": "boolean" },
      "isDeleted": { "type": "boolean" },
      "createdAt": { "type": "date" },
      "updatedAt": { "type": "date" }
    }
  }
}

// Search Query Example
db.messages.aggregate([
  {
    $search: {
      index: "messages_text_search",
      text: {
        query: "project deadline",
        path: "content",
        fuzzy: {
          maxEdits: 2
        }
      }
    }
  },
  {
    $match: {
      isDeleted: false
    }
  },
  {
    $limit: 20
  }
]);
```

### 3.2 Users Search Index
```javascript
// MongoDB Atlas Search Index Definition
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "_id": { "type": "objectId" },
      "email": {
        "type": "string",
        "analyzer": "lucene.keyword"
      },
      "name": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "phone": {
        "type": "string",
        "analyzer": "lucene.keyword"
      },
      "role": { "type": "string" },
      "status": { "type": "string" }
    }
  }
}

// Search Query Example
db.users.aggregate([
  {
    $search: {
      index: "users_text_search",
      text: {
        query: "john",
        path: ["name", "email"],
        fuzzy: {
          maxEdits: 1
        }
      }
    }
  },
  {
    $limit: 10
  }
]);
```

---

## 🤖 4. AI/ML INTEGRATION REQUIREMENTS

### 4.1 AI Assistant (OpenAI GPT-4 / Anthropic Claude)

#### Purpose:
- Help users compose messages
- Summarize conversations
- Improve message clarity
- Answer questions about channels

#### Implementation:

**API Integration:**
```javascript
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function processAIPrompt(userId, prompt, context = null) {
  /**
   * Process user prompt with AI model
   * 
   * @param {string} userId - User requesting AI assistance
   * @param {string} prompt - User's input prompt
   * @param {Object} context - Optional context (channel history, mentioned messages)
   * 
   * @returns {Object} AI response and metadata
   */
  
  // Build conversation context
  const messages = [
    {
      role: "system",
      content: "You are a helpful assistant for a team chat application. Help users with writing, summarizing, and improving their messages."
    }
  ];
  
  // Add context if provided
  if (context && context.messageHistory) {
    messages.push({
      role: "system",
      content: `Channel context: ${JSON.stringify(context.messageHistory)}`
    });
  }
  
  // Add user prompt
  messages.push({ role: "user", content: prompt });
  
  // Call OpenAI API
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: messages,
    max_tokens: 500,
    temperature: 0.7
  });
  
  const aiResponse = response.choices[0].message.content;
  const tokensUsed = response.usage.total_tokens;
  
  // Store in MongoDB for analytics/billing
  await db.collection('aiPrompts').insertOne({
    userId: new ObjectId(userId),
    prompt,
    response: aiResponse,
    model: "gpt-4",
    tokensUsed,
    processingTime: Date.now() - startTime,
    context,
    createdAt: new Date()
  });
  
  return { response: aiResponse, tokensUsed };
}
```

**Rate Limiting:**
- 50 requests per user per hour
- Track token usage for billing

**Features to Implement:**
1. **Message Composition**: "Write a professional message about..."
2. **Summarization**: "Summarize the last 50 messages in this channel"
3. **Improvement**: "Make this message more professional/casual/clear"
4. **Translation**: "Translate this message to Spanish"
5. **Q&A**: "What decisions were made in today's standup?"

---

### 4.2 Content Moderation (AI-Powered)

#### Purpose:
- Detect toxic/offensive content
- Flag spam messages
- Identify inappropriate images

#### Implementation:

**Text Moderation:**
```javascript
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function moderateMessageContent(content) {
  /**
   * Check message content for policy violations
   * 
   * @returns {Object} Moderation result
   */
  
  const response = await openai.moderations.create({
    input: content
  });
  
  const result = response.results[0];
  
  if (result.flagged) {
    const categories = Object.keys(result.categories).filter(
      cat => result.categories[cat]
    );
    
    // High severity = auto-block
    const highSeverity = 
      result.category_scores.violence > 0.8 || 
      result.category_scores.hate > 0.8;
    
    return {
      flagged: true,
      categories,
      action: highSeverity ? "block" : "flag"
    };
  }
  
  return { flagged: false, action: "allow" };
}
```

**Image Moderation:**
```javascript
const vision = require('@google-cloud/vision');
const client = new vision.ImageAnnotatorClient();

async function moderateImage(imageUrl) {
  /**
   * Analyze image for inappropriate content
   */
  
  const [result] = await client.safeSearchDetection(imageUrl);
  const detections = result.safeSearchAnnotation;
  
  // Check severity levels
  const Likelihood = vision.protos.google.cloud.vision.v1.Likelihood;
  
  if (
    detections.adult >= Likelihood.LIKELY ||
    detections.violence >= Likelihood.LIKELY
  ) {
    return { flagged: true, action: "block" };
  }
  
  return { flagged: false, action: "allow" };
}
```

**Implementation Steps:**
1. Check all new messages before saving
2. If flagged, store with `isModerated: true` flag
3. Notify admins of flagged content
4. Auto-hide messages with "block" action
5. Store moderation logs for appeals

---

### 4.3 Voice Message Transcription

#### Purpose:
- Convert voice messages to text
- Enable search in voice messages
- Accessibility for hearing-impaired users

#### Implementation:

**Using Whisper (OpenAI):**
```javascript
const OpenAI = require('openai');
const fs = require('fs');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function transcribeVoiceMessage(audioFilePath, language = "en") {
  /**
   * Transcribe voice message to text
   * 
   * @param {string} audioFilePath - Path to audio file
   * @param {string} language - ISO language code
   * 
   * @returns {string} Transcribed text
   */
  
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioFilePath),
    model: "whisper-1",
    language: language
  });
  
  return transcription.text;
}
```

**Process:**
1. User uploads voice message
2. Store audio file in cloud storage (S3/CloudFlare/GridFS)
3. Queue transcription job (async)
4. Save transcription to `voiceMessages` collection
5. Index transcription for search

---

### 4.4 Smart Notifications (ML-Based)

#### Purpose:
- Prioritize important notifications
- Reduce notification fatigue
- Learn user preferences

#### Implementation:

**Notification Scoring Model:**
```javascript
class NotificationScorer {
  constructor() {
    // Load pre-trained ML model
    this.model = loadModel('notification_scorer.model');
  }
  
  extractFeatures(notification, userHistory) {
    /**
     * Extract features for ML model
     */
    return {
      senderInteractionFreq: userHistory.interactionsWithSender / userHistory.totalInteractions,
      channelActivityLevel: notification.channelMessagesPerHour,
      messageLength: notification.content.length,
      hasMention: notification.hasMention ? 1 : 0,
      timeOfDay: new Date(notification.timestamp).getHours(),
      userAvgResponseTime: userHistory.avgResponseTimeMinutes,
      isDM: notification.isDM ? 1 : 0,
      senderIsAdmin: notification.senderIsAdmin ? 1 : 0
    };
  }
  
  async scoreNotification(notification, userHistory) {
    /**
     * Score notification priority
     * 
     * @returns {number} Priority score between 0 (low) and 1 (high)
     */
    const features = this.extractFeatures(notification, userHistory);
    const priorityScore = await this.model.predict(features);
    return priorityScore;
  }
  
  async shouldSendPush(notification, userHistory) {
    /**
     * Decide if push notification should be sent
     */
    const score = await this.scoreNotification(notification, userHistory);
    
    // Send push only for high-priority notifications
    if (score > 0.7) {
      return true;
    }
    
    // Or if user has DND disabled and it's a DM
    if (!userHistory.dndEnabled && notification.isDM) {
      return true;
    }
    
    return false;
  }
}
```

**Training Data:**
- Collect user interactions: which notifications did they respond to?
- Features: sender, channel, time, message content
- Label: did user engage (read, reply, react)?
- Retrain model weekly

---

### 4.5 Smart Search (Semantic Search)

#### Purpose:
- Understand user intent
- Find relevant messages even with different wording
- Suggest search queries

#### Implementation:

**Using MongoDB Atlas Vector Search:**
```javascript
const { SentenceTransformer } = require('sentence-transformers');
const model = new SentenceTransformer('all-MiniLM-L6-v2');

// Create vector search index in MongoDB Atlas
// Index definition:
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 384,
      "similarity": "cosine"
    }
  ]
}

async function buildMessageEmbeddings() {
  /**
   * Generate embeddings for all messages
   */
  const messages = await db.collection('messages').find().toArray();
  
  for (const message of messages) {
    const embedding = await model.encode(message.content);
    
    await db.collection('messages').updateOne(
      { _id: message._id },
      { $set: { embedding: Array.from(embedding) } }
    );
  }
}

async function semanticSearch(query, topK = 10) {
  /**
   * Semantic search for messages
   * 
   * @param {string} query - User's search query
   * @param {number} topK - Number of results to return
   * 
   * @returns {Array} Ranked message results
   */
  
  // Encode query
  const queryEmbedding = await model.encode(query);
  
  // Vector search in MongoDB Atlas
  const results = await db.collection('messages').aggregate([
    {
      $search: {
        index: "messages_vector_search",
        knnBeta: {
          vector: Array.from(queryEmbedding),
          path: "embedding",
          k: topK
        }
      }
    },
    {
      $project: {
        _id: 1,
        content: 1,
        userId: 1,
        channelId: 1,
        createdAt: 1,
        score: { $meta: "searchScore" }
      }
    }
  ]).toArray();
  
  return results;
}
```

**Implementation Steps:**
1. Generate embeddings for all messages (batch process)
2. Store embeddings in MongoDB with vector index
3. When user searches, embed query and find similar messages
4. Combine with traditional keyword search
5. Re-rank results

---

### 4.6 Auto-Summarization (Daily/Weekly Digests)

#### Purpose:
- Summarize channel activity
- Highlight important decisions/announcements
- Send email digests

#### Implementation:

**Channel Summary Generator:**
```javascript
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateChannelSummary(channelId, startDate, endDate) {
  /**
   * Generate summary of channel activity for a time period
   */
  
  // Fetch messages from MongoDB
  const messages = await db.collection('messages')
    .find({
      channelId: new ObjectId(channelId),
      createdAt: { $gte: startDate, $lte: endDate },
      isDeleted: false
    })
    .sort({ createdAt: 1 })
    .toArray();
  
  // Get user names
  const userIds = [...new Set(messages.map(m => m.userId))];
  const users = await db.collection('users')
    .find({ _id: { $in: userIds } })
    .toArray();
  
  const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u.name]));
  
  // Format messages for AI
  const conversation = messages.map(m => 
    `${userMap[m.userId.toString()]}: ${m.content}`
  ).join('\n');
  
  // Generate summary
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant that summarizes team conversations. Focus on key decisions, action items, and important announcements."
      },
      {
        role: "user",
        content: `Summarize this conversation:\n\n${conversation}`
      }
    ],
    max_tokens: 300
  });
  
  const summary = response.choices[0].message.content;
  
  // Extract action items
  const actionItems = extractActionItems(summary);
  
  return {
    summary,
    actionItems,
    messageCount: messages.length,
    participantCount: userIds.length
  };
}

function extractActionItems(summary) {
  /**
   * Extract action items using regex
   */
  const actionPattern = /(?:TODO|Action item|Task):?\s*(.+)/gi;
  const matches = [...summary.matchAll(actionPattern)];
  return matches.map(m => m[1]);
}
```

**Schedule:**
- Daily summary at 6 PM (previous 24 hours)
- Weekly summary on Monday (previous week)
- Send via email and in-app notification

---

### 4.7 Sentiment Analysis

#### Purpose:
- Detect team morale
- Flag potential conflicts
- Monitor channel health

#### Implementation:

**Using Transformers:**
```javascript
const { pipeline } = require('@xenova/transformers');

// Initialize sentiment analysis pipeline
const sentimentAnalyzer = await pipeline(
  'sentiment-analysis',
  'Xenova/distilbert-base-uncased-finetuned-sst-2-english'
);

async function analyzeChannelSentiment(channelId, timeWindowHours = 24) {
  /**
   * Analyze sentiment of recent channel messages
   * 
   * @param {string} channelId - Channel to analyze
   * @param {number} timeWindowHours - Hours to look back
   * 
   * @returns {Object} Sentiment analysis result
   */
  
  // Fetch recent messages
  const cutoffTime = new Date(Date.now() - timeWindowHours * 3600000);
  const messages = await db.collection('messages')
    .find({
      channelId: new ObjectId(channelId),
      createdAt: { $gte: cutoffTime },
      isDeleted: false
    })
    .toArray();
  
  // Analyze each message
  const sentiments = [];
  let negativeCount = 0;
  
  for (const msg of messages) {
    const result = await sentimentAnalyzer(msg.content);
    const sentiment = result[0];
    
    const score = sentiment.label === 'POSITIVE' 
      ? sentiment.score 
      : -sentiment.score;
    
    sentiments.push(score);
    
    if (sentiment.label === 'NEGATIVE' && sentiment.score > 0.8) {
      negativeCount++;
    }
  }
  
  // Calculate overall sentiment
  const avgSentiment = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
  
  // Alert if too many negative messages
  const alert = negativeCount > messages.length * 0.3; // More than 30% negative
  
  return {
    overallSentiment: avgSentiment > 0.2 ? "positive" : (avgSentiment < -0.2 ? "negative" : "neutral"),
    sentimentScore: avgSentiment,
    negativeMessagesCount: negativeCount,
    alert
  };
}
```

**Use Cases:**
- Admin dashboard showing channel sentiment
- Alert admins if sentiment drops suddenly
- Suggest team-building activities

---

### 4.8 Link Preview Generation

#### Purpose:
- Extract metadata from URLs
- Generate rich previews
- Cache results

#### Implementation:

**URL Metadata Extractor:**
```javascript
const axios = require('axios');
const cheerio = require('cheerio');

async function generateLinkPreview(url) {
  /**
   * Extract Open Graph metadata from URL
   * 
   * @returns {Object} Link preview data
   */
  
  // Check Redis cache first
  const cached = await redisClient.get(`link_preview:${url}`);
  if (cached) {
    return JSON.parse(cached);
  }
  
  try {
    const response = await axios.get(url, { 
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    // Extract Open Graph tags
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const ogDescription = $('meta[property="og:description"]').attr('content');
    const ogImage = $('meta[property="og:image"]').attr('content');
    const ogSiteName = $('meta[property="og:site_name"]').attr('content');
    
    // Fallback to regular meta tags
    const title = ogTitle || $('title').text() || '';
    const description = ogDescription || $('meta[name="description"]').attr('content') || '';
    const image = ogImage || '';
    const siteName = ogSiteName || '';
    
    const preview = {
      url,
      title: title.substring(0, 100),
      description: description.substring(0, 200),
      image,
      siteName
    };
    
    // Cache for 7 days
    await redisClient.setex(
      `link_preview:${url}`,
      604800,
      JSON.stringify(preview)
    );
    
    return preview;
  } catch (error) {
    console.error('Link preview error:', error);
    return null;
  }
}
```

**Features:**
- Auto-detect URLs in messages
- Generate previews asynchronously
- Cache results to avoid repeated requests
- Handle timeouts gracefully

---

## 📊 5. ANALYTICS & METRICS (Data to Track)

### 5.1 User Metrics (Aggregation Pipeline Examples)
```javascript
// Daily Active Users
db.users.aggregate([
  {
    $match: {
      lastSeen: { $gte: new Date(Date.now() - 24 * 3600000) }
    }
  },
  { $count: "dailyActiveUsers" }
]);

// Messages sent per user
db.messages.aggregate([
  {
    $match: {
      createdAt: { $gte: new Date(Date.now() - 24 * 3600000) }
    }
  },
  {
    $group: {
      _id: "$userId",
      messageCount: { $sum: 1 }
    }
  },
  { $sort: { messageCount: -1 } },
  { $limit: 10 }
]);
```

### 5.2 Channel Metrics
```javascript
// Most active channels
db.messages.aggregate([
  {
    $match: {
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 3600000) }
    }
  },
  {
    $group: {
      _id: "$channelId",
      messageCount: { $sum: 1 }
    }
  },
  {
    $lookup: {
      from: "channels",
      localField: "_id",
      foreignField: "_id",
      as: "channel"
    }
  },
  { $sort: { messageCount: -1 } },
  { $limit: 10 }
]);
```

### 5.3 Message Metrics
- Total messages sent
- Messages per hour/day
- Average message length
- Reaction rate
- Thread participation rate

### 5.4 Performance Metrics
- API response times (p50, p95, p99)
- WebSocket connection stability
- Database query performance
- Cache hit rate
- Error rates

### 5.5 AI Metrics
```javascript
// AI usage analytics
db.aiPrompts.aggregate([
  {
    $match: {
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 3600000) }
    }
  },
  {
    $group: {
      _id: null,
      totalPrompts: { $sum: 1 },
      totalTokens: { $sum: "$tokensUsed" },
      avgProcessingTime: { $avg: "$processingTime" }
    }
  }
]);
```

---

## 🔐 6. DATA SECURITY & PRIVACY

### 6.1 Encryption
- **At Rest**: Use MongoDB field-level encryption for sensitive fields
- **In Transit**: TLS 1.3 for all connections
- **End-to-End**: Consider E2E encryption for DMs (Signal Protocol)

**MongoDB Field-Level Encryption Example:**
```javascript
const { ClientEncryption } = require('mongodb');

// Configure client-side field level encryption
const clientEncryption = new ClientEncryption(client, {
  keyVaultNamespace: 'encryption.__keyVault',
  kmsProviders: {
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  }
});

// Encrypt sensitive fields
const encryptedPassword = await clientEncryption.encrypt(
  passwordHash,
  { algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic' }
);
```

### 6.2 Data Retention
- Messages: Retain indefinitely (with option to delete)
- Attachments: 90-day retention for free tier
- Audit logs: 1 year (use TTL index)
- Session tokens: Auto-delete after expiry (TTL index)

**TTL Index Example:**
```javascript
// Auto-delete sessions after expiry
db.sessions.createIndex(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

// Auto-delete audit logs after 1 year
db.auditLogs.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 31536000 }
);
```

### 6.3 GDPR Compliance
```javascript
// Export user data
async function exportUserData(userId) {
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
  const messages = await db.collection('messages').find({ userId: new ObjectId(userId) }).toArray();
  const channels = await db.collection('channelMembers').find({ userId: new ObjectId(userId) }).toArray();
  
  return {
    user,
    messages,
    channels,
    exportedAt: new Date()
  };
}

// Delete user (anonymize)
async function deleteUser(userId) {
  // Anonymize user data
  await db.collection('users').updateOne(
    { _id: new ObjectId(userId) },
    {
      $set: {
        email: `deleted_${userId}@deleted.com`,
        name: 'Deleted User',
        passwordHash: null,
        deletedAt: new Date()
      }
    }
  );
  
  // Keep messages but anonymize author
  await db.collection('messages').updateMany(
    { userId: new ObjectId(userId) },
    { $set: { userId: null } }
  );
}
```

### 6.4 Backup Strategy
- **MongoDB**: Daily full backup + continuous oplog backup
- **Redis**: RDB snapshots every 6 hours
- **Attachments**: Versioned backups in cloud storage
- **Retention**: 30 days

---

## 🚀 7. PERFORMANCE OPTIMIZATION

### 7.1 MongoDB Optimizations
```javascript
// Use projection to limit returned fields
db.messages.find(
  { channelId: channelId },
  { content: 1, userId: 1, createdAt: 1 }
).limit(50);

// Use lean() in Mongoose for faster queries
Message.find({ channelId }).lean().limit(50);

// Implement pagination with cursor
db.messages.find({ channelId })
  .sort({ createdAt: -1 })
  .skip(page * limit)
  .limit(limit);

// Better: Use cursor-based pagination
db.messages.find({
  channelId,
  _id: { $lt: lastSeenId }
}).sort({ _id: -1 }).limit(20);
```

### 7.2 Caching Strategy
```javascript
// Cache user profiles
async function getUserProfile(userId) {
  const cacheKey = `user:${userId}`;
  
  // Check cache
  let user = await redisClient.get(cacheKey);
  if (user) return JSON.parse(user);
  
  // Fetch from MongoDB
  user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
  
  // Cache for 5 minutes
  await redisClient.setex(cacheKey, 300, JSON.stringify(user));
  
  return user;
}

// Cache recent messages
async function getRecentMessages(channelId, limit = 50) {
  const cacheKey = `messages:recent:${channelId}`;
  
  // Check cache
  let messages = await redisClient.lrange(cacheKey, 0, limit - 1);
  if (messages.length > 0) {
    return messages.map(m => JSON.parse(m));
  }
  
  // Fetch from MongoDB
  messages = await db.collection('messages')
    .find({ channelId: new ObjectId(channelId) })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  
  // Cache
  const pipeline = redisClient.pipeline();
  messages.forEach(m => pipeline.rpush(cacheKey, JSON.stringify(m)));
  pipeline.expire(cacheKey, 3600);
  await pipeline.exec();
  
  return messages;
}
```

### 7.3 Query Optimization
- Use appropriate indexes
- Avoid $where and $regex when possible
- Use covered queries
- Monitor slow queries
- Use aggregation pipeline for complex queries

### 7.4 Scalability
- **Horizontal Scaling**: MongoDB Sharding
- **Read Replicas**: Use secondary nodes for read operations
- **Connection Pooling**: Limit concurrent connections
- **Rate Limiting**: Prevent abuse
- **WebSocket Clustering**: Use Redis adapter for Socket.IO

**MongoDB Sharding Example:**
```javascript
// Shard messages collection by channelId
sh.enableSharding("chatapp");
sh.shardCollection(
  "chatapp.messages",
  { channelId: 1, createdAt: 1 }
);
```

---

## 📈 8. MONITORING & ALERTING

### 8.1 Metrics to Monitor
- MongoDB CPU/memory usage
- Connection pool saturation
- Redis memory usage
- API response times
- WebSocket connections
- Error rates (4xx, 5xx)
- Queue length (for async jobs)

### 8.2 Alerts to Configure
- MongoDB connection pool exhausted
- Redis memory > 90%
- API response time > 1 second (p95)
- Error rate > 1%
- Disk space < 20%
- SSL certificate expiring in < 30 days

### 8.3 Logging
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Log with trace ID for request tracking
logger.info('User logged in', {
  userId: user._id,
  traceId: req.headers['x-trace-id'],
  ip: req.ip
});
```

---

## 🧪 9. TESTING REQUIREMENTS

### 9.1 Database Testing
```javascript
// Unit tests for MongoDB operations
const { MongoMemoryServer } = require('mongodb-memory-server');

describe('Message Operations', () => {
  let mongoServer;
  let db;
  
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    const client = new MongoClient(uri);
    await client.connect();
    db = client.db('test');
  });
  
  test('should create message', async () => {
    const message = {
      channelId: new ObjectId(),
      userId: new ObjectId(),
      content: 'Test message',
      createdAt: new Date()
    };
    
    const result = await db.collection('messages').insertOne(message);
    expect(result.insertedId).toBeDefined();
  });
  
  afterAll(async () => {
    await mongoServer.stop();
  });
});
```

### 9.2 AI/ML Testing
- Test AI response quality (human evaluation)
- Test moderation accuracy (false positive/negative rates)
- Test transcription accuracy
- Monitor AI API costs
- A/B testing for notification scoring

### 9.3 Performance Testing
- Load testing: 1000 concurrent users
- Stress testing: Find breaking point
- WebSocket connection testing: 10,000 concurrent connections
- Database query performance benchmarks

---

## ✅ IMPLEMENTATION CHECKLIST

### Database Setup (Week 1-2)
- [ ] Set up MongoDB cluster (Atlas or self-hosted)
- [ ] Create all collections with schema validation
- [ ] Create indexes for all collections
- [ ] Set up Redis for caching
- [ ] Configure MongoDB Atlas Search for full-text search
- [ ] Implement backup strategy
- [ ] Set up monitoring (MongoDB Atlas charts or Prometheus)

### AI Integration (Week 3-4)
- [ ] OpenAI API integration for AI assistant
- [ ] Content moderation implementation
- [ ] Voice transcription with Whisper
- [ ] Semantic search with vector embeddings
- [ ] Notification scoring model

### Optimization (Week 5)
- [ ] Database query optimization
- [ ] Implement caching layer with Redis
- [ ] Set up CDN for static assets
- [ ] Configure connection pooling
- [ ] Load testing and tuning

### Security (Week 6)
- [ ] Implement field-level encryption
- [ ] Set up TLS certificates
- [ ] Configure rate limiting
- [ ] Implement audit logging
- [ ] GDPR compliance features (data export, deletion)

---

## 🔄 MONGODB TRANSACTIONS

For operations requiring atomicity:

```javascript
const session = client.startSession();

try {
  await session.withTransaction(async () => {
    // Create DM channel
    const channel = await db.collection('channels').insertOne({
      name: `dm_${user1Id}_${user2Id}`,
      type: 'dm',
      createdBy: user1Id,
      createdAt: new Date()
    }, { session });
    
    // Add both users as members
    await db.collection('channelMembers').insertMany([
      { channelId: channel.insertedId, userId: user1Id, joinedAt: new Date() },
      { channelId: channel.insertedId, userId: user2Id, joinedAt: new Date() }
    ], { session });
    
    // Create DM channel mapping
    await db.collection('dmChannels').insertOne({
      channelId: channel.insertedId,
      user1Id,
      user2Id,
      createdAt: new Date()
    }, { session });
  });
} finally {
  await session.endSession();
}
```

---

This document provides the complete MongoDB database schema and AI/ML requirements for the ConnectBest Chat application backend team. All AI features are designed to be implemented incrementally and can be scaled based on usage and budget.
