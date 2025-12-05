# Static Data Locations and Backend Integration Plan

This document lists all locations where static or mock data is currently used in the frontend.  
For each location, it describes how the behavior should change once the real backend APIs and database are fully integrated.

---

## 📁 1. AUTHENTICATION & USER DATA

### `lib/mockAuthStore.ts`
- Replace this module with calls to real authentication endpoints.
- All user data should come from and be persisted in the backend (database), not from a local Map or array.
- Any logic that creates or updates users must go through the backend.

### `lib/auth.ts`
- Remove the in-memory users array.
- Replace all read/write operations with requests to the backend user service.
- User information (profile, status, etc.) should be retrieved from the backend on demand or via a cached client.
**Action Required**: Connect to users table in database

### `components/providers/AuthProvider.tsx`
- login()
  1. Call the backend login endpoint.
  2. Handle tokens (e.g., via httpOnly cookies or headers) as defined by the backend.

- register()
  1. Call the backend registration endpoint.
  2. Handle validation errors and success responses returned from the backend.

- logout()
  1. Invoke the backend logout endpoint if one exists.
  2. Clear any client-side session state after a successful response.

- checkAuth()
  1. Use a backend endpoint (for example /api/auth/me) to verify the current authenticated user.
  2. Keep the frontend auth state in sync with backend session status.

### `app/api/auth/login/route.ts`
- Validate credentials by calling into the backend authentication logic.
- Issue or forward a signed token/session according to the backend’s auth strategy.
- Return appropriate HTTP status codes and error messages on failure.

### `app/api/auth/register/route.ts`
- Create users via the backend user creation logic.
- Ensure passwords are hashed and stored securely.
- Enforce uniqueness constraints for emails/usernames.
- Optionally trigger email verification flows if supported.

### `app/api/auth/logout/route.ts`
- Invalidate or revoke the user session/token on the backend if applicable.
- Clear cookies or client-side storage tied to the session.
- Return a consistent response format for the frontend to handle

### `app/api/auth/me/route.ts`
- Validate the current session or token.
- Fetch the authenticated user’s profile from the database.
- Return user data (id, name, email, avatar, roles, etc.) in a stable format for the frontend.

---

## 💬 2. CHANNELS & MESSAGES

### `lib/mockChatStore.ts`
- Replace with calls to backend endpoints that read from and write to the database.
- Make sure pagination, ordering (e.g., by timestamp), and filtering happen via backend queries.

### `components/chat/ChannelView.tsx`
- Replace hardcoded user maps with data fetched from the backend (e.g., users or members endpoints).
- Fetch messages from backend endpoints for channels and DMs.
- Use the backend’s real-time or WebSocket events for:
  1. New messages
  2. Typing indicators
  3. Presence/status changes
-Connect reactions, pins, bookmarks, edits, and deletions to dedicated backend endpoints.
- Wire file and clip uploads to the backend’s upload service, using the returned URLs/metadata on messages.
- Use backend support for link previews if available, or a dedicated service.
- Ensure all write operations (send, edit, delete, pin, bookmark, schedule) are handled via authenticated backend APIs.

### `components/chat/ChannelSidebar.tsx`
- Load channel and DM lists from backend endpoints.
- Retrieve presence/status information from backend or real-time service.
- Keep the sidebar in sync with backend changes (e.g., new channels, DMs, or membership updates).

### `components/chat/ChannelHeader.tsx`
- Populate member lists using backend channel/membership endpoints.
- Implement add/remove member operations by calling backend APIs.
- Update channel name/topic/settings via backend update endpoints.
- Lock/unlock channels using backend state (e.g., a locked flag in the channel model).
- Ensure all changes are persisted and broadcast to other clients as needed.

### `app/api/chat/channels/route.ts`
- Fetch channel data from the channels table/collection in the database.
- Apply authorization or visibility rules (e.g., only channels the user is a member of).
- Support additional query parameters (pagination, search, filters) if required by the UI.

### `app/api/chat/channels/[channelId]/messages/route.ts`
- Query the messages table/collection for the given channelId.
- Order messages appropriately (e.g., by created timestamp).
- Support pagination (e.g., limit and cursor/before/after parameters) if needed

### `app/api/chat/channels/[channelId]/messages/send/route.ts`
- Validate the request (auth, channel membership, content).
- Create a new message record in the database.
- Return the saved message object.
- Trigger any real-time events (e.g., via WebSocket) so other clients receive the message.

---

## 🎙️ 3. VOICE/VIDEO/CALLS

### `components/chat/CallControls.tsx`
- Connect to a signaling server or backend endpoints responsible for:
  1. Exchanging WebRTC offer/answer and ICE candidates.
  2. Managing call rooms/sessions.
- Ensure call start, end, and screen-sharing actions are backed by real signaling logic.

### `components/chat/HuddlePanel.tsx`
- Implement backend endpoints or real-time channels for:
  1. Creating/joining/leaving huddles.
  2. Persisting and broadcasting participant state (muted/deafened).
- Keep huddle state synchronized across clients via the backend.

---

## 📄 4. CANVAS & DOCUMENTS

### `components/chat/CanvasEditor.tsx`
- Implement backend APIs to:
  1. List documents by channel or context.
  2. Create a new canvas/document.
  3. Update existing documents with new content.
  4. Delete documents when requested.
- Ensure access control (who can view/edit) is enforced on the backend.

---

## 🎬 5. CLIPS & RECORDINGS

### `components/chat/ClipsRecorder.tsx`
- Implement backend endpoints to receive recorded audio/video clips.
- Store clips in persistent storage (e.g., local disk, object storage, or CDN).
- Return clip URLs and metadata so the frontend can attach them to messages or channels.

---

## 🔍 6. SEARCH

### `components/chat/SearchBar.tsx`
- Replace mockResults with a call to a search API.
- The backend can implement search using the chosen technology (for example, a database full-text search or a dedicated search engine).
- The API should support searching across:
  1. Messages
  2. Channels
  3. Users
  4. Files (if applicable)

---

## 🤖 7. AI ASSISTANT

### `components/chat/AIAssistant.tsx`
- Replace mockResponse with a call to a backend AI service.
- The backend can:
  1. Forward prompts to an external AI provider.
  2. Apply authorization, rate limiting, and logging.
  3. Return AI responses in a consistent format for the frontend.

---

## 📁 8. FILE UPLOAD

### `components/chat/FileUploader.tsx`
-Implement a backend upload endpoint for handling file uploads.
- Store files in a persistent location (local filesystem, object storage, etc.).
- Return file metadata (URL, type, size, etc.) to the frontend.
- Attach returned file metadata to messages or other entities as needed.

---

## 🧵 9. THREADS

### `components/chat/ThreadPanel.tsx`
- Add backend endpoints for:
  1. Creating a reply to an existing message.
  2. Listing replies for a given thread or parent message.
- Ensure the data model distinguishes between top-level messages and replies.

---

## 🎨 10. GIF PICKER

### `components/chat/GifPicker.tsx`
- Integrate with a GIF search provider or a backend proxy that calls such a service.
- Replace mock arrays with results from the provider.
- Handle API keys and rate limits on the backend side where appropriate.

---

## 👥 11. USER DIRECTORY

### `components/chat/UserDirectory.tsx`
- Fetch the full user directory from the backend.
- Support server-side pagination, search, and filtering where necessary.
- Ensure sensitive fields are not exposed to unauthorized users.

---

## ⚙️ 12. USER PROFILE & SETTINGS

### `components/ui/ProfileMenu.tsx`
- Send profile changes (status, availability, etc.) to the backend.
- Persist settings in the user record or a related settings table.
- Reflect changes across sessions and devices.

### `app/(app)/profile/page.tsx`
- Use a backend endpoint (e.g., PUT /api/users/me) to update user profile fields.
- Integrate avatar upload with the file upload backend.
- Load current profile data from the backend on page load.

### `components/chat/NotificationSettings.tsx`
- Implement backend APIs to store per-user or per-channel notification preferences.
- Allow the frontend to read and update these preferences.
- Ensure they affect how and when notifications are sent.

---

## 🔧 13. ADMIN PANEL

### `app/(app)/admin/page.tsx`
- Connect admin actions (e.g., suspend user, update roles) to backend admin endpoints.
- Fetch user and system data from the backend rather than static arrays.
- Enforce permission checks on the backend to ensure only admins can perform sensitive actions.

### `app/(app)/ops/page.tsx`
- Replace mock metrics with real data from the backend.
- Connect to endpoints that expose logs, metrics, or health information.
- Ensure the data is appropriate for observability/ops use cases.

### `app/api/metrics/route.ts`
- Aggregate real metrics (requests, errors, latency, etc.) from your backend or monitoring system.
- Return metrics in a format that the UI can visualize or inspect.

---

## 🌐 14. WEBSOCKET/REAL-TIME

### `components/providers/SocketProvider.tsx`
- Configure the provider to connect to the real WebSocket/Socket server.
- Subscribe to events such as:
  1. New messages
  2. Typing indicators
  3. Presence updates
  4. Channel updates
- Ensure authentication (e.g., token-based) is handled consistently with the rest of the system.

---

## 📧 15. EMAIL

### `lib/email.ts`
- Configure a real email transport (SMTP or provider API) on the backend.
- Move any sensitive configuration (API keys, passwords) to environment variables.
- Use backend endpoints to trigger emails (verification, password reset, notifications).

---

## 📝 16. API CLIENT

### `lib/api.ts`
- Configure baseURL for different environments (development, staging, production).
- Add interceptors for authentication (e.g., attaching tokens or handling 401 responses).
- Ensure all frontend API calls go through this shared client.

---

## 🔐 17. PASSWORD RESET

### `app/(auth)/forgot/page.tsx`
- Implement a backend endpoint to initiate the password reset process.
- Send a secure reset link or token via email.
- Handle user feedback (success/failure) based on backend responses.

---

## 📊 18. EMOJI PICKER

### `components/chat/EmojiPicker.tsx`
- Footer text

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

## ✅ VERIFICATION CHECKLIST

- ✅ Authentication works with real database
- ✅ Messages persist and sync across clients
- ✅ File uploads go to cloud storage
- ✅ Search returns relevant results
- ✅ WebSocket provides real-time updates
- ✅ Voice/video calls establish connections
- ✅ All mock data comments removed
- ✅ Error handling implemented
- ✅ Rate limiting configured
- ✅ Security best practices followed