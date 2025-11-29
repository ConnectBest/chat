# Static Data Locations - Replace with Dynamic Backend Data

This document lists all locations where static/mock data is used in the frontend. The backend team should replace these with actual API calls and database queries.

---

## 🔍 Quick Search
Search for: `Static code Backend team please change it to dynamic`

---

## 📁 1. AUTHENTICATION & USER DATA

### `lib/mockAuthStore.ts`
**Line 2** - Entire file is mock in-memory auth store
```typescript
// Static code Backend team please change it to dynamic
const users = new Map();
```
**Action Required**: Replace with database-backed authentication

### `lib/auth.ts`
**Line 19** - In-memory user store
```typescript
// In-memory store for development - Static code Backend team please change it to dynamic
const users: User[] = [];
```
**Action Required**: Connect to users table in database

### `components/providers/AuthProvider.tsx`
**Lines 5, 38, 53, 68, 78** - Mock auth API calls
- **Line 38**: `login()` - Mock login implementation
- **Line 53**: `register()` - Mock registration  
- **Line 68**: `logout()` - Mock logout
- **Line 78**: `checkAuth()` - Mock auth check
**Action Required**: Replace with real authentication service

### `app/api/auth/login/route.ts`
**Line 4** - Mock login endpoint
**Action Required**: Implement JWT-based authentication

### `app/api/auth/register/route.ts`
**Line 17** - Mock registration endpoint
**Action Required**: Create users in database with password hashing

### `app/api/auth/logout/route.ts`
**Line 2** - Mock logout endpoint
**Action Required**: Invalidate tokens/sessions

### `app/api/auth/me/route.ts`
**Line 4** - Mock user profile endpoint
**Action Required**: Return authenticated user from database

---

## 💬 2. CHANNELS & MESSAGES

### `lib/mockChatStore.ts`
**Line 2** - Entire file is mock message store
```typescript
// Static code Backend team please change it to dynamic
```
**Action Required**: Replace with database queries

### `components/chat/ChannelView.tsx`
**Multiple lines** - Mock message and user data
- **Line 87**: DM user lookup - hardcoded user data
  ```typescript
  const userMap: Record<string, { name: string; email: string; ... }> = {
    '2': { name: 'Alice Johnson', ... },
    '3': { name: 'Bob Smith', ... },
  };
  ```
- **Line 97**: Mock DM messages
- **Line 106**: Socket.io typing events commented out
- **Line 121**: Mock attachments array
- **Line 139**: Mock reaction handling
- **Line 173**: File upload handling
- **Line 206**: Typing indicator emit
- **Line 238**: Link preview extraction (needs backend)
- **Line 260**: Edit message (PUT /api/messages/:id)
- **Line 270**: Delete message (DELETE /api/messages/:id)
- **Line 275**: Pin message (POST /api/messages/:id/pin)
- **Line 282**: Bookmark message (POST /api/messages/:id/bookmark)
- **Line 314**: Voice message recording
- **Line 325**: Voice message send
- **Line 395**: Schedule message (POST /api/messages/schedule)
- **Line 453**: Clips upload
- **Line 493**: Channel update (PUT /api/channels/:id)

**Action Required**: Connect all operations to backend APIs

### `components/chat/ChannelSidebar.tsx`
**Lines 31, 106, 153** - Mock DM users and data
- **Line 31**: Hardcoded DM list
  ```typescript
  const dmUsers = [
    { id: '2', name: 'Alice Johnson', status: 'online' as const },
    { id: '3', name: 'Bob Smith', status: 'away' as const },
    ...
  ];
  ```
- **Line 106**: Mock full user data for DMs
- **Line 153**: Footer text

**Action Required**: Fetch DM list from API

### `components/chat/ChannelHeader.tsx`
**Lines 55, 65, 95, 101, 111, 120, 361** - Mock users and channel operations
- **Line 55**: Mock users list for adding members
- **Line 65**: Mock current channel members
- **Line 95**: Add member (POST /api/channels/:id/members)
- **Line 101**: Remove member (DELETE /api/channels/:id/members/:userId)
- **Line 111**: Update channel (PUT /api/channels/:id)
- **Line 120**: Lock/unlock channel (PUT /api/channels/:id/lock)
- **Line 361**: Footer text

**Action Required**: Connect to channels API

### `app/api/chat/channels/route.ts`
**Line 4** - Mock channel list endpoint
**Action Required**: Fetch from channels table

### `app/api/chat/channels/[channelId]/messages/route.ts`
**Line 4** - Mock messages list endpoint
**Action Required**: Fetch from messages table

### `app/api/chat/channels/[channelId]/messages/send/route.ts`
**Line 4** - Mock send message endpoint
**Action Required**: Save to messages table

---

## 🎙️ 3. VOICE/VIDEO/CALLS

### `components/chat/CallControls.tsx`
**Lines 56, 78, 125, 166, 372** - WebRTC signaling
- **Line 56**: Start audio call
- **Line 78**: Start video call
- **Line 125**: Screen sharing
- **Line 166**: End call signaling
- **Line 372**: Footer text

**Action Required**: Implement WebRTC signaling server

### `components/chat/HuddlePanel.tsx`
**Lines 42, 58, 68, 81** - Huddle operations
- **Line 42**: Start huddle (POST /api/huddles/start)
- **Line 58**: Leave huddle (POST /api/huddles/leave)
- **Line 68**: Toggle mute (POST /api/huddles/mute)
- **Line 81**: Toggle deafen (POST /api/huddles/deafen)

**Action Required**: Implement huddles API

---

## 📄 4. CANVAS & DOCUMENTS

### `components/chat/CanvasEditor.tsx`
**Lines 31, 69, 92, 102** - Canvas operations
- **Line 31**: Load documents (GET /api/canvas/:channelId)
- **Line 69**: Create document (POST /api/canvas)
- **Line 92**: Update document (PUT /api/canvas/:id)
- **Line 102**: Delete document (DELETE /api/canvas/:id)

**Action Required**: Implement canvas API

---

## 🎬 5. CLIPS & RECORDINGS

### `components/chat/ClipsRecorder.tsx`
**Multiple lines** - Clip recording and upload
**Action Required**: Implement video/audio recording upload to cloud storage

---

## 🔍 6. SEARCH

### `components/chat/SearchBar.tsx`
**Lines 32, 112** - Mock search
- **Line 32**: Mock search implementation with hardcoded results
  ```typescript
  const mockResults = [
    { id: '1', type: 'message' as const, content: 'Project deadline...', ... },
    { id: '2', type: 'channel' as const, name: 'general', ... },
  ];
  ```
- **Line 112**: Footer text

**Action Required**: Implement search API with Elasticsearch/Atlas Search

---

## 🤖 7. AI ASSISTANT

### `components/chat/AIAssistant.tsx`
**Line 27** - Mock AI response
```typescript
// Static code Backend team please change it to dynamic - Call AI API
const mockResponse = `AI Response to: "${prompt}"...`;
```
**Action Required**: Integrate OpenAI/Claude API

---

## 📁 8. FILE UPLOAD

### `components/chat/FileUploader.tsx`
**Lines 23, 125** - Mock file upload
- **Line 23**: Simulated upload progress
- **Line 125**: Footer text

**Action Required**: Implement file upload to cloud storage (S3/CloudFlare)

---

## 🧵 9. THREADS

### `components/chat/ThreadPanel.tsx`
**Line 27** - Mock thread reply
```typescript
// Static code Backend team please change it to dynamic (POST /api/messages/:id/replies)
```
**Action Required**: Implement threaded messages API

---

## 🎨 10. GIF PICKER

### `components/chat/GifPicker.tsx`
**Lines 33, 95** - Mock GIF search
- **Line 33**: Hardcoded GIF results
  ```typescript
  const mockGifs = [
    { id: '1', url: 'https://media.giphy.com/media/...', title: 'Happy Dance' },
    ...
  ];
  ```
- **Line 95**: Footer text

**Action Required**: Integrate Giphy API

---

## 👥 11. USER DIRECTORY

### `components/chat/UserDirectory.tsx`
**Lines 34, 108** - Mock user list
- **Line 34**: Hardcoded users array
  ```typescript
  const allUsers = [
    { id: '1', name: 'Current User', email: 'current@example.com', ... },
    { id: '2', name: 'Alice Johnson', email: 'alice@example.com', ... },
    ...
  ];
  ```
- **Line 108**: Footer text

**Action Required**: Fetch from users table

---

## ⚙️ 12. USER PROFILE & SETTINGS

### `components/ui/ProfileMenu.tsx`
**Lines 47, 199** - User status update
- **Line 47**: Update status in database
- **Line 199**: Footer text

**Action Required**: Implement user profile update API

### `app/(app)/profile/page.tsx`
**Lines 26, 92, 132** - Profile updates
- **Line 26**: Update profile (PUT /api/users/me)
- **Line 92**: Avatar upload placeholder
- **Line 132**: Footer text

**Action Required**: Implement profile management API

### `components/chat/NotificationSettings.tsx`
**Line 21** - Notification preferences
```typescript
// Static code Backend team please change it to dynamic (PUT /api/channels/:id/notifications)
```
**Action Required**: Store notification preferences

---

## 🔧 13. ADMIN PANEL

### `app/(app)/admin/page.tsx`
**Lines 32, 55, 221** - Mock admin data
- **Line 32**: Hardcoded users list
- **Line 55**: Mock admin operations
- **Line 221**: Footer text

**Action Required**: Implement admin API

### `app/(app)/ops/page.tsx`
**Lines 37, 262** - Mock operations data
- **Line 37**: Hardcoded metrics
- **Line 262**: Footer text

**Action Required**: Implement monitoring/metrics API

### `app/api/metrics/route.ts`
**Line 3** - Mock metrics endpoint
**Action Required**: Collect real metrics

---

## 🌐 14. WEBSOCKET/REAL-TIME

### `components/providers/SocketProvider.tsx`
**Lines 6, 21, 22** - WebSocket connection
- **Line 6**: Mock Socket.IO provider
- **Line 21-22**: Socket endpoint configuration

**Action Required**: Set up Socket.IO server at /ws

---

## 📧 15. EMAIL

### `lib/email.ts`
**Line 6** - Email configuration
```typescript
// Email transporter configuration - Static code Backend team please change it to dynamic
```
**Action Required**: Configure SMTP/SendGrid for email sending

---

## 📝 16. API CLIENT

### `lib/api.ts`
**Line 4** - API client baseURL
```typescript
// Static code Backend team please change it to dynamic
const client = axios.create({ baseURL: '/' });
```
**Action Required**: Configure production API base URL

---

## 🔐 17. PASSWORD RESET

### `app/(auth)/forgot/page.tsx`
**Lines 16, 40** - Password reset
- **Line 16**: Mock forgot password (POST /api/auth/forgot)
- **Line 40**: Footer text

**Action Required**: Implement password reset flow

---

## 📊 18. EMOJI PICKER

### `components/chat/EmojiPicker.tsx`
**Line 66** - Footer text
**Action Required**: No backend changes needed

---

## 🗂️ SUMMARY BY PRIORITY

### 🔴 **Critical (Must implement first)**
1. **Authentication** - Login, register, logout, JWT
2. **Messages** - Send, receive, list messages
3. **Channels** - List channels, channel members
4. **WebSocket** - Real-time message updates
5. **User Management** - User profiles, status

### 🟡 **High Priority (Core features)**
6. **File Upload** - Image/document upload to cloud
7. **Search** - Message and user search
8. **Reactions** - Message reactions
9. **Threads** - Threaded replies
10. **Direct Messages** - DM creation and management

### 🟢 **Medium Priority (Enhanced features)**
11. **Voice/Video Calls** - WebRTC signaling
12. **Huddles** - Audio rooms
13. **Canvas** - Collaborative documents
14. **Clips** - Video recordings
15. **AI Assistant** - OpenAI integration
16. **Notifications** - Push notifications
17. **Admin Panel** - User management, analytics

### ⚪ **Low Priority (Nice to have)**
18. **GIF Picker** - Giphy integration
19. **Email** - Email notifications
20. **Scheduled Messages** - Message scheduling

---

## 🔍 HOW TO FIND STATIC DATA

Search your codebase for:
```
Static code Backend team please change it to dynamic
```

All 89 instances are marked with this comment!

---

## ✅ VERIFICATION CHECKLIST

Once backend APIs are implemented, verify:

- [ ] Authentication works with real database
- [ ] Messages persist and sync across clients
- [ ] File uploads go to cloud storage
- [ ] Search returns relevant results
- [ ] WebSocket provides real-time updates
- [ ] Voice/video calls establish connections
- [ ] All mock data comments removed
- [ ] Error handling implemented
- [ ] Rate limiting configured
- [ ] Security best practices followed

---

**Last Updated**: November 27, 2025
**Total Static Data Locations**: 89
**Files Affected**: 30+
