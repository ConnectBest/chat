# Database Schema & AI/ML Requirements - ConnectBest Chat Application

## 📋 Overview
This document provides comprehensive database schema design and AI/ML integration requirements for the ConnectBest Chat application backend team.

---

## 🗄️ 1. DATABASE SCHEMA (PostgreSQL)

### 1.1 Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- NULL for OAuth-only users
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'away', 'busy', 'inmeeting', 'offline')),
    status_message TEXT,
    avatar_url TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(6),
    verification_expires TIMESTAMP,
    reset_token UUID,
    reset_expires TIMESTAMP,
    two_fa_enabled BOOLEAN DEFAULT FALSE,
    two_fa_secret VARCHAR(32),
    google_id VARCHAR(255) UNIQUE,
    last_login TIMESTAMP,
    last_seen TIMESTAMP,
    account_status VARCHAR(20) DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'deleted')),
    suspension_reason TEXT,
    preferences JSONB DEFAULT '{"notifications": true, "soundEnabled": true, "timezone": "UTC"}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at);
```

---

### 1.2 Channels Table
```sql
CREATE TABLE channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL DEFAULT 'public' CHECK (type IN ('public', 'private', 'dm')),
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_channels_name ON channels(name);
CREATE INDEX idx_channels_type ON channels(type);
CREATE INDEX idx_channels_created_by ON channels(created_by);
CREATE INDEX idx_channels_created_at ON channels(created_at);
```

---

### 1.3 Channel Members Table
```sql
CREATE TABLE channel_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_at TIMESTAMP DEFAULT NOW(),
    last_read_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(channel_id, user_id)
);

CREATE INDEX idx_channel_members_channel ON channel_members(channel_id);
CREATE INDEX idx_channel_members_user ON channel_members(user_id);
CREATE INDEX idx_channel_members_last_read ON channel_members(last_read_at);
```

---

### 1.4 Messages Table
```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    parent_message_id UUID REFERENCES messages(id) ON DELETE CASCADE, -- For threads
    content TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP,
    scheduled_for TIMESTAMP, -- For scheduled messages
    status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'failed', 'scheduled')),
    metadata JSONB, -- For storing mentions, link previews, etc.
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_messages_channel ON messages(channel_id);
CREATE INDEX idx_messages_user ON messages(user_id);
CREATE INDEX idx_messages_parent ON messages(parent_message_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_scheduled ON messages(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX idx_messages_content_fts ON messages USING gin(to_tsvector('english', content));
```

---

### 1.5 Message Reactions Table
```sql
CREATE TABLE reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(message_id, user_id) -- User can have only one reaction per message
);

CREATE INDEX idx_reactions_message ON reactions(message_id);
CREATE INDEX idx_reactions_user ON reactions(user_id);
```

---

### 1.6 Attachments Table
```sql
CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    uploader_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    thumbnail_url TEXT,
    file_size BIGINT NOT NULL, -- In bytes
    mime_type VARCHAR(100) NOT NULL,
    file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('image', 'video', 'audio', 'document', 'other')),
    metadata JSONB, -- Width, height, duration, etc.
    uploaded_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP -- For cleanup of unused attachments
);

CREATE INDEX idx_attachments_message ON attachments(message_id);
CREATE INDEX idx_attachments_uploader ON attachments(uploader_id);
CREATE INDEX idx_attachments_expires ON attachments(expires_at) WHERE expires_at IS NOT NULL;
```

---

### 1.7 Voice Messages Table
```sql
CREATE TABLE voice_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    audio_url TEXT NOT NULL,
    duration INTEGER NOT NULL, -- In seconds
    waveform_data JSONB, -- Array of amplitude values for visualization
    transcription TEXT, -- AI-generated transcription (optional)
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_voice_messages_message ON voice_messages(message_id);
```

---

### 1.8 Direct Messages (DMs) Table
```sql
-- DMs are stored as regular channels with type='dm'
-- This table tracks DM metadata
CREATE TABLE dm_channels (
    id UUID PRIMARY KEY REFERENCES channels(id) ON DELETE CASCADE,
    user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user1_id, user2_id),
    CHECK (user1_id < user2_id) -- Ensure consistent ordering
);

CREATE INDEX idx_dm_channels_user1 ON dm_channels(user1_id);
CREATE INDEX idx_dm_channels_user2 ON dm_channels(user2_id);
```

---

### 1.9 Notifications Table
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('mention', 'dm', 'reaction', 'thread_reply', 'system')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
```

---

### 1.10 Huddles Table
```sql
CREATE TABLE huddles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    title VARCHAR(255),
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'ended')),
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP,
    duration INTEGER, -- In seconds, calculated when ended
    UNIQUE(channel_id) WHERE status = 'active' -- Only one active huddle per channel
);

CREATE INDEX idx_huddles_channel ON huddles(channel_id);
CREATE INDEX idx_huddles_status ON huddles(status);
```

---

### 1.11 Huddle Participants Table
```sql
CREATE TABLE huddle_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    huddle_id UUID NOT NULL REFERENCES huddles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_muted BOOLEAN DEFAULT FALSE,
    is_deafened BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP DEFAULT NOW(),
    left_at TIMESTAMP,
    UNIQUE(huddle_id, user_id) WHERE left_at IS NULL -- User can't join twice
);

CREATE INDEX idx_huddle_participants_huddle ON huddle_participants(huddle_id);
CREATE INDEX idx_huddle_participants_user ON huddle_participants(user_id);
```

---

### 1.12 Canvas Documents Table
```sql
CREATE TABLE canvas_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT, -- Markdown content
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    last_edited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    version INTEGER DEFAULT 1,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    last_edited_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_canvas_channel ON canvas_documents(channel_id);
CREATE INDEX idx_canvas_created_by ON canvas_documents(created_by);
CREATE INDEX idx_canvas_last_edited ON canvas_documents(last_edited_at);
```

---

### 1.13 Canvas Document Versions Table
```sql
CREATE TABLE canvas_document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES canvas_documents(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    edited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(document_id, version)
);

CREATE INDEX idx_canvas_versions_document ON canvas_document_versions(document_id);
CREATE INDEX idx_canvas_versions_version ON canvas_document_versions(version);
```

---

### 1.14 Clips Table
```sql
CREATE TABLE clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255),
    type VARCHAR(20) NOT NULL CHECK (type IN ('video', 'audio')),
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    duration INTEGER NOT NULL, -- In seconds
    file_size BIGINT NOT NULL,
    metadata JSONB, -- Resolution, codec, bitrate, etc.
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP, -- For auto-cleanup
    deleted_at TIMESTAMP
);

CREATE INDEX idx_clips_channel ON clips(channel_id);
CREATE INDEX idx_clips_uploaded_by ON clips(uploaded_by);
CREATE INDEX idx_clips_expires ON clips(expires_at) WHERE expires_at IS NOT NULL;
```

---

### 1.15 Calls Table
```sql
CREATE TABLE calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    dm_channel_id UUID REFERENCES dm_channels(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('audio', 'video', 'screen_share')),
    started_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('ringing', 'active', 'ended', 'missed', 'declined')),
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP,
    duration INTEGER, -- In seconds
    CHECK ((channel_id IS NOT NULL AND dm_channel_id IS NULL) OR (channel_id IS NULL AND dm_channel_id IS NOT NULL))
);

CREATE INDEX idx_calls_channel ON calls(channel_id);
CREATE INDEX idx_calls_dm_channel ON calls(dm_channel_id);
CREATE INDEX idx_calls_started_by ON calls(started_by);
CREATE INDEX idx_calls_status ON calls(status);
```

---

### 1.16 Call Participants Table
```sql
CREATE TABLE call_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_muted BOOLEAN DEFAULT FALSE,
    video_enabled BOOLEAN DEFAULT TRUE,
    screen_sharing BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP DEFAULT NOW(),
    left_at TIMESTAMP
);

CREATE INDEX idx_call_participants_call ON call_participants(call_id);
CREATE INDEX idx_call_participants_user ON call_participants(user_id);
```

---

### 1.17 Scheduled Messages Table
```sql
CREATE TABLE scheduled_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    scheduled_for TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
    sent_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    attachment_ids UUID[], -- Array of attachment IDs
    created_at TIMESTAMP DEFAULT NOW(),
    sent_at TIMESTAMP,
    cancelled_at TIMESTAMP
);

CREATE INDEX idx_scheduled_messages_channel ON scheduled_messages(channel_id);
CREATE INDEX idx_scheduled_messages_user ON scheduled_messages(user_id);
CREATE INDEX idx_scheduled_messages_scheduled_for ON scheduled_messages(scheduled_for);
CREATE INDEX idx_scheduled_messages_status ON scheduled_messages(status);
```

---

### 1.18 AI Prompts Table
```sql
CREATE TABLE ai_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES channels(id) ON DELETE SET NULL,
    prompt TEXT NOT NULL,
    response TEXT NOT NULL,
    model VARCHAR(50) NOT NULL, -- e.g., "gpt-4", "claude-3"
    tokens_used INTEGER,
    processing_time INTEGER, -- In milliseconds
    context JSONB, -- Additional context like message history
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ai_prompts_user ON ai_prompts(user_id);
CREATE INDEX idx_ai_prompts_created_at ON ai_prompts(created_at);
```

---

### 1.19 Sessions Table (JWT Token Blacklist)
```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
```

---

### 1.20 Audit Logs Table
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- e.g., "user.suspended", "channel.deleted"
    entity_type VARCHAR(50) NOT NULL, -- e.g., "user", "channel", "message"
    entity_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

---

## 🔴 2. REDIS SCHEMA (Caching & Real-Time)

### 2.1 User Presence/Status
```
Key: user:presence:{user_id}
Type: Hash
Fields:
  - status: "online" | "away" | "busy" | "inmeeting" | "offline"
  - statusMessage: string
  - lastSeen: timestamp
TTL: 5 minutes (auto-refresh on activity)
```

### 2.2 Typing Indicators
```
Key: typing:{channel_id}
Type: Set
Members: user_id
TTL: 5 seconds (auto-expire if not refreshed)
```

### 2.3 Unread Message Counts
```
Key: unread:{user_id}:{channel_id}
Type: Integer
Value: count of unread messages
No TTL (persist)
```

### 2.4 Rate Limiting
```
Key: ratelimit:{endpoint}:{user_id}
Type: Integer
Value: request count
TTL: Based on rate limit window (e.g., 1 minute, 1 hour)
```

### 2.5 Active WebSocket Connections
```
Key: ws:connections:{user_id}
Type: Set
Members: connection_id
TTL: None (manual cleanup on disconnect)
```

### 2.6 Channel Online Users
```
Key: channel:online:{channel_id}
Type: Set
Members: user_id
TTL: None (manual management)
```

### 2.7 Session Cache
```
Key: session:{token_hash}
Type: Hash
Fields:
  - userId: string
  - role: string
  - expiresAt: timestamp
TTL: Match JWT expiry
```

### 2.8 Message Cache (Recent Messages)
```
Key: messages:recent:{channel_id}
Type: List
Members: message JSON objects
Max Length: 100 (keep last 100 messages)
TTL: 1 hour
```

---

## 🔍 3. ELASTICSEARCH SCHEMA (Full-Text Search)

### 3.1 Messages Index
```json
{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "channelId": { "type": "keyword" },
      "userId": { "type": "keyword" },
      "userName": { "type": "text" },
      "content": {
        "type": "text",
        "analyzer": "english",
        "fields": {
          "raw": { "type": "keyword" }
        }
      },
      "attachments": {
        "type": "nested",
        "properties": {
          "filename": { "type": "text" },
          "type": { "type": "keyword" }
        }
      },
      "mentions": { "type": "keyword" },
      "isPinned": { "type": "boolean" },
      "isDeleted": { "type": "boolean" },
      "createdAt": { "type": "date" },
      "updatedAt": { "type": "date" }
    }
  }
}
```

### 3.2 Users Index
```json
{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "email": { "type": "keyword" },
      "name": {
        "type": "text",
        "analyzer": "standard",
        "fields": {
          "keyword": { "type": "keyword" }
        }
      },
      "phone": { "type": "keyword" },
      "role": { "type": "keyword" },
      "status": { "type": "keyword" }
    }
  }
}
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
```python
import openai

async def process_ai_prompt(user_id: str, prompt: str, context: dict = None):
    """
    Process user prompt with AI model
    
    Args:
        user_id: User requesting AI assistance
        prompt: User's input prompt
        context: Optional context (channel history, mentioned messages)
    
    Returns:
        AI response text
    """
    
    # Build conversation context
    messages = [
        {"role": "system", "content": "You are a helpful assistant for a team chat application. Help users with writing, summarizing, and improving their messages."}
    ]
    
    # Add context if provided
    if context and context.get('messageHistory'):
        messages.append({
            "role": "system", 
            "content": f"Channel context: {context['messageHistory']}"
        })
    
    # Add user prompt
    messages.append({"role": "user", "content": prompt})
    
    # Call OpenAI API
    response = await openai.ChatCompletion.acreate(
        model="gpt-4",
        messages=messages,
        max_tokens=500,
        temperature=0.7
    )
    
    ai_response = response.choices[0].message.content
    
    # Store in database for analytics/billing
    await store_ai_interaction(user_id, prompt, ai_response, response.usage.total_tokens)
    
    return ai_response
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
```python
from openai import OpenAI

async def moderate_message_content(content: str):
    """
    Check message content for policy violations
    
    Returns:
        {
            "flagged": bool,
            "categories": ["hate", "harassment", "violence", ...],
            "action": "allow" | "flag" | "block"
        }
    """
    
    client = OpenAI()
    response = await client.moderations.create(input=content)
    
    result = response.results[0]
    
    if result.flagged:
        # Determine action based on severity
        categories = [cat for cat, flagged in result.categories.__dict__.items() if flagged]
        
        # High severity = auto-block
        if result.category_scores.violence > 0.8 or result.category_scores.hate > 0.8:
            action = "block"
        else:
            action = "flag"  # Flag for admin review
        
        return {
            "flagged": True,
            "categories": categories,
            "action": action
        }
    
    return {"flagged": False, "action": "allow"}
```

**Image Moderation:**
```python
import google.cloud.vision

async def moderate_image(image_url: str):
    """
    Analyze image for inappropriate content
    """
    client = vision.ImageAnnotatorClient()
    image = vision.Image()
    image.source.image_uri = image_url
    
    response = client.safe_search_detection(image=image)
    safe = response.safe_search_annotation
    
    # Check severity levels
    if (safe.adult >= vision.Likelihood.LIKELY or 
        safe.violence >= vision.Likelihood.LIKELY):
        return {"flagged": True, "action": "block"}
    
    return {"flagged": False, "action": "allow"}
```

**Implementation Steps:**
1. Check all new messages before saving
2. If flagged, store with `is_moderated=true` flag
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
```python
import openai

async def transcribe_voice_message(audio_file_path: str, language: str = "en"):
    """
    Transcribe voice message to text
    
    Args:
        audio_file_path: Path to audio file
        language: ISO language code (optional)
    
    Returns:
        Transcribed text
    """
    
    with open(audio_file_path, "rb") as audio_file:
        transcript = await openai.Audio.atranscribe(
            model="whisper-1",
            file=audio_file,
            language=language
        )
    
    return transcript.text
```

**Process:**
1. User uploads voice message
2. Store audio file in cloud storage
3. Queue transcription job (async)
4. Save transcription to `voice_messages.transcription`
5. Index transcription in Elasticsearch for search

---

### 4.4 Smart Notifications (ML-Based)

#### Purpose:
- Prioritize important notifications
- Reduce notification fatigue
- Learn user preferences

#### Implementation:

**Notification Scoring Model:**
```python
import numpy as np
from sklearn.ensemble import RandomForestClassifier

class NotificationScorer:
    def __init__(self):
        self.model = RandomForestClassifier()
        self.features = [
            'sender_interaction_frequency',
            'channel_activity_level',
            'message_length',
            'has_mention',
            'time_of_day',
            'user_response_time_avg',
            'is_dm',
            'sender_is_admin'
        ]
    
    def extract_features(self, notification: dict, user_history: dict):
        """Extract features for ML model"""
        return np.array([
            user_history['interactions_with_sender'] / user_history['total_interactions'],
            notification['channel_messages_per_hour'],
            len(notification['content']),
            1 if notification['has_mention'] else 0,
            notification['timestamp'].hour,
            user_history['avg_response_time_minutes'],
            1 if notification['is_dm'] else 0,
            1 if notification['sender_is_admin'] else 0
        ])
    
    def score_notification(self, notification: dict, user_history: dict):
        """
        Score notification priority
        
        Returns:
            Float between 0 (low priority) and 1 (high priority)
        """
        features = self.extract_features(notification, user_history)
        priority_score = self.model.predict_proba([features])[0][1]
        return priority_score
    
    def should_send_push(self, notification: dict, user_history: dict):
        """Decide if push notification should be sent"""
        score = self.score_notification(notification, user_history)
        
        # Send push only for high-priority notifications
        if score > 0.7:
            return True
        
        # Or if user has DND disabled and it's a DM
        if not user_history['dnd_enabled'] and notification['is_dm']:
            return True
        
        return False
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

**Using Sentence Transformers:**
```python
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np

class SemanticSearchEngine:
    def __init__(self):
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        self.index = None
        self.message_ids = []
    
    def build_index(self, messages: list):
        """Build FAISS index from message embeddings"""
        
        # Extract message texts
        texts = [msg['content'] for msg in messages]
        self.message_ids = [msg['id'] for msg in messages]
        
        # Generate embeddings
        embeddings = self.model.encode(texts)
        
        # Create FAISS index
        dimension = embeddings.shape[1]
        self.index = faiss.IndexFlatL2(dimension)
        self.index.add(np.array(embeddings).astype('float32'))
    
    def search(self, query: str, top_k: int = 10):
        """
        Semantic search for messages
        
        Args:
            query: User's search query
            top_k: Number of results to return
        
        Returns:
            List of message IDs ranked by relevance
        """
        
        # Encode query
        query_embedding = self.model.encode([query])
        
        # Search in index
        distances, indices = self.index.search(
            np.array(query_embedding).astype('float32'), 
            top_k
        )
        
        # Return message IDs
        results = [
            {
                'message_id': self.message_ids[idx],
                'score': float(1 / (1 + distances[0][i]))  # Convert distance to similarity
            }
            for i, idx in enumerate(indices[0])
        ]
        
        return results
```

**Implementation Steps:**
1. Generate embeddings for all messages (batch process)
2. Store embeddings in vector database (FAISS, Pinecone, or Weaviate)
3. When user searches, embed query and find similar messages
4. Combine with traditional keyword search (Elasticsearch)
5. Re-rank results

---

### 4.6 Auto-Summarization (Daily/Weekly Digests)

#### Purpose:
- Summarize channel activity
- Highlight important decisions/announcements
- Send email digests

#### Implementation:

**Channel Summary Generator:**
```python
import openai

async def generate_channel_summary(channel_id: str, start_date: datetime, end_date: datetime):
    """
    Generate summary of channel activity for a time period
    """
    
    # Fetch messages from database
    messages = await fetch_messages(channel_id, start_date, end_date)
    
    # Format messages for AI
    conversation = "\n".join([
        f"{msg['user_name']}: {msg['content']}"
        for msg in messages
    ])
    
    # Generate summary
    response = await openai.ChatCompletion.acreate(
        model="gpt-4",
        messages=[
            {
                "role": "system",
                "content": "You are a helpful assistant that summarizes team conversations. Focus on key decisions, action items, and important announcements."
            },
            {
                "role": "user",
                "content": f"Summarize this conversation:\n\n{conversation}"
            }
        ],
        max_tokens=300
    )
    
    summary = response.choices[0].message.content
    
    # Extract action items
    action_items = extract_action_items(summary)
    
    return {
        "summary": summary,
        "action_items": action_items,
        "message_count": len(messages),
        "participant_count": len(set(msg['user_id'] for msg in messages))
    }

def extract_action_items(summary: str):
    """Extract action items using regex or additional AI call"""
    # Look for bullet points, "TODO", "action item", etc.
    import re
    action_pattern = r'(?:TODO|Action item|Task):?\s*(.+)'
    return re.findall(action_pattern, summary, re.IGNORECASE)
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
```python
from transformers import pipeline

sentiment_analyzer = pipeline("sentiment-analysis", model="distilbert-base-uncased-finetuned-sst-2-english")

async def analyze_channel_sentiment(channel_id: str, time_window: int = 24):
    """
    Analyze sentiment of recent channel messages
    
    Args:
        channel_id: Channel to analyze
        time_window: Hours to look back
    
    Returns:
        {
            "overall_sentiment": "positive" | "negative" | "neutral",
            "sentiment_score": float (0-1),
            "negative_messages_count": int,
            "alert": bool
        }
    """
    
    # Fetch recent messages
    cutoff_time = datetime.now() - timedelta(hours=time_window)
    messages = await fetch_messages_since(channel_id, cutoff_time)
    
    # Analyze each message
    sentiments = []
    negative_count = 0
    
    for msg in messages:
        result = sentiment_analyzer(msg['content'])[0]
        sentiments.append(result['score'] if result['label'] == 'POSITIVE' else -result['score'])
        
        if result['label'] == 'NEGATIVE' and result['score'] > 0.8:
            negative_count += 1
    
    # Calculate overall sentiment
    avg_sentiment = np.mean(sentiments) if sentiments else 0
    
    # Alert if too many negative messages
    alert = negative_count > len(messages) * 0.3  # More than 30% negative
    
    return {
        "overall_sentiment": "positive" if avg_sentiment > 0.2 else ("negative" if avg_sentiment < -0.2 else "neutral"),
        "sentiment_score": float(avg_sentiment),
        "negative_messages_count": negative_count,
        "alert": alert
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
```python
import aiohttp
from bs4 import BeautifulSoup
import re

async def generate_link_preview(url: str):
    """
    Extract Open Graph metadata from URL
    
    Returns:
        {
            "url": str,
            "title": str,
            "description": str,
            "image": str,
            "siteName": str
        }
    """
    
    # Check cache first
    cached = await redis.get(f"link_preview:{url}")
    if cached:
        return json.loads(cached)
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=5) as response:
                html = await response.text()
        
        soup = BeautifulSoup(html, 'html.parser')
        
        # Extract Open Graph tags
        og_title = soup.find('meta', property='og:title')
        og_description = soup.find('meta', property='og:description')
        og_image = soup.find('meta', property='og:image')
        og_site_name = soup.find('meta', property='og:site_name')
        
        # Fallback to regular meta tags
        title = og_title['content'] if og_title else soup.find('title').text if soup.find('title') else ''
        description = og_description['content'] if og_description else soup.find('meta', {'name': 'description'})
        description = description['content'] if description else ''
        image = og_image['content'] if og_image else ''
        site_name = og_site_name['content'] if og_site_name else ''
        
        preview = {
            "url": url,
            "title": title[:100],  # Truncate
            "description": description[:200],
            "image": image,
            "siteName": site_name
        }
        
        # Cache for 7 days
        await redis.setex(f"link_preview:{url}", 604800, json.dumps(preview))
        
        return preview
    
    except Exception as e:
        return None
```

**Features:**
- Auto-detect URLs in messages
- Generate previews asynchronously
- Cache results to avoid repeated requests
- Handle timeouts gracefully

---

## 📊 5. ANALYTICS & METRICS (Data to Track)

### 5.1 User Metrics
- Daily/Weekly/Monthly active users (DAU/WAU/MAU)
- Average session duration
- Messages sent per user
- Channels joined per user
- Feature usage (calls, huddles, clips, AI assistant)

### 5.2 Channel Metrics
- Most active channels
- Average messages per day
- Peak activity hours
- Member growth
- Engagement rate (% of members who posted)

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
- AI prompts per user
- Token usage and costs
- AI feature adoption rate
- User satisfaction (thumbs up/down on responses)

---

## 🔐 6. DATA SECURITY & PRIVACY

### 6.1 Encryption
- **At Rest**: Encrypt sensitive fields (passwords, tokens) using AES-256
- **In Transit**: TLS 1.3 for all API calls
- **End-to-End**: Consider E2E encryption for DMs (Signal Protocol)

### 6.2 Data Retention
- Messages: Retain indefinitely (with option to delete)
- Attachments: 90-day retention for free tier, longer for paid
- Audit logs: 1 year
- Session tokens: Auto-delete after expiry

### 6.3 GDPR Compliance
- User data export (JSON format)
- Right to be forgotten (soft delete with anonymization)
- Data processing agreements
- Cookie consent
- Privacy policy

### 6.4 Backup Strategy
- PostgreSQL: Daily full backup + continuous WAL archiving
- Redis: RDB snapshots every 6 hours
- Attachments: Versioned backups in cloud storage
- Retention: 30 days

---

## 🚀 7. PERFORMANCE OPTIMIZATION

### 7.1 Database Optimizations
- Use connection pooling (PgBouncer)
- Implement read replicas for scaling reads
- Partition large tables (messages, audit_logs) by date
- Use materialized views for analytics
- Regularly vacuum and analyze tables

### 7.2 Caching Strategy
- Cache user profiles (5-minute TTL)
- Cache channel lists (1-minute TTL)
- Cache recent messages (Redis List, 100 messages)
- Use CDN for static assets and attachments
- Implement cache warming for popular channels

### 7.3 Query Optimization
- Use prepared statements
- Implement pagination for all list endpoints
- Use cursor-based pagination for real-time feeds
- Create composite indexes for common queries
- Monitor slow queries and optimize

### 7.4 Scalability
- Horizontal scaling with load balancer
- Separate read/write database connections
- Use message queue (RabbitMQ/Kafka) for async tasks
- Implement rate limiting to prevent abuse
- Use WebSocket clustering (Redis adapter)

---

## 📈 8. MONITORING & ALERTING

### 8.1 Metrics to Monitor
- Database CPU/memory usage
- Redis memory usage
- API response times
- WebSocket connections
- Error rates (4xx, 5xx)
- Queue length (for async jobs)

### 8.2 Alerts to Configure
- Database connection pool exhausted
- Redis memory > 90%
- API response time > 1 second (p95)
- Error rate > 1%
- Disk space < 20%
- SSL certificate expiring in < 30 days

### 8.3 Logging
- Structured logging (JSON format)
- Log levels: DEBUG, INFO, WARNING, ERROR, CRITICAL
- Log aggregation (ELK Stack or Datadog)
- Trace IDs for request tracking
- PII redaction in logs

---

## 🧪 9. TESTING REQUIREMENTS

### 9.1 Database Testing
- Unit tests for all database operations
- Test data migrations
- Test indexes are used (EXPLAIN ANALYZE)
- Test foreign key constraints
- Load testing for concurrent writes

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
- [ ] Set up PostgreSQL with all tables
- [ ] Create indexes and constraints
- [ ] Set up Redis for caching
- [ ] Configure Elasticsearch for search
- [ ] Implement backup strategy
- [ ] Set up monitoring (Prometheus/Grafana)

### AI Integration (Week 3-4)
- [ ] OpenAI API integration for AI assistant
- [ ] Content moderation implementation
- [ ] Voice transcription with Whisper
- [ ] Semantic search with embeddings
- [ ] Notification scoring model

### Optimization (Week 5)
- [ ] Database query optimization
- [ ] Implement caching layer
- [ ] Set up CDN for static assets
- [ ] Configure connection pooling
- [ ] Load testing and tuning

### Security (Week 6)
- [ ] Implement encryption at rest
- [ ] Set up TLS certificates
- [ ] Configure rate limiting
- [ ] Implement audit logging
- [ ] GDPR compliance features

---

This document provides the complete database schema and AI/ML requirements for the ConnectBest Chat application backend team. All AI features are designed to be implemented incrementally and can be scaled based on usage and budget.
