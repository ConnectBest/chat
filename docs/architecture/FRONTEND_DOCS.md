# ConnectBest Chat Frontend - Complete Documentation

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup & Run
```bash
npm install
npm run dev
```
Open http://localhost:3000

### Test Account
- Email: `demo@test.com`
- Password: any password (mock auth)

## ✨ Implemented Features

### ✅ Authentication & User Management
- Login, register, password recovery pages
- Form validation with React Hook Form + Zod
- JWT-style token auth (localStorage)
- Auto-redirect after login
- Protected routes

### ✅ Real-time Messaging
- Send/receive messages
- Emoji picker for messages (😀 button)
- File attachments with drag & drop (📎 button)
- Message reactions (one per user, click to change)
- Message threads (💬 Thread button)
- Typing indicators with animated dots
- Search messages (🔍 at top)

### ✅ Channels & Organization
- Create new channels
- Dynamic channel list in sidebar
- Active channel highlighting
- Mobile-responsive hamburger menu

### ✅ User Features
- Profile settings page (⚙️ button)
  - Avatar upload
  - Status message
  - Notification preferences
  - Timezone selection
- Presence indicators (green/yellow/gray dots)

### ✅ Admin Tools
- Admin Dashboard (🛡️ button)
  - User management table
  - Suspend/activate accounts
  - Delete users with confirmation
  - Channel management
  - Role badges (admin/user)
  - Status indicators

### ✅ Operations & Monitoring
- Ops Dashboard (📊 button)
  - Health status (healthy/degraded/down)
  - Real-time metrics:
    - Active connections
    - Total messages
    - Average latency
    - Error rate
    - CPU/Memory usage
  - Live charts (Recharts):
    - Response latency line chart
    - Active connections chart
    - Error count bar chart
  - Auto-refresh (5s interval)

### ✅ Responsive Design
- Mobile: Hamburger menu, single column
- Tablet: Collapsible sidebar
- Desktop: Full sidebar + content
- Touch-optimized interactions

### ✅ Accessibility
- ARIA labels on interactive elements
- Keyboard navigation support
- Screen reader friendly
- Focus management
- Semantic HTML

## 📁 Project Structure

```
chat/
├── app/
│   ├── (auth)/                  # Public auth routes
│   │   ├── login/page.tsx       # Login form
│   │   ├── register/page.tsx    # Registration
│   │   └── forgot/page.tsx      # Password recovery
│   ├── (app)/                   # Protected routes
│   │   ├── chat/
│   │   │   ├── layout.tsx       # Chat layout with sidebar
│   │   │   └── [channelId]/page.tsx  # Dynamic channel route
│   │   ├── admin/page.tsx       # Admin dashboard
│   │   ├── ops/page.tsx         # Ops monitoring
│   │   └── profile/page.tsx     # User profile
│   ├── api/                     # Mock backend
│   │   ├── auth/               # Auth endpoints
│   │   ├── chat/               # Chat endpoints
│   │   ├── health/route.ts     # Health check
│   │   └── metrics/route.ts    # Metrics endpoint
│   ├── globals.css             # Tailwind + custom styles
│   └── layout.tsx              # Root with providers
│
├── components/
│   ├── chat/
│   │   ├── ChannelSidebar.tsx  # Channel list + navigation
│   │   ├── ChannelView.tsx     # Main chat interface
│   │   ├── EmojiPicker.tsx     # Emoji selection + reactions
│   │   ├── FileUploader.tsx    # Drag-drop file upload
│   │   ├── SearchBar.tsx       # Message search
│   │   ├── ThreadPanel.tsx     # Threaded replies
│   │   └── TypingIndicator.tsx # Typing animation
│   ├── providers/
│   │   ├── AuthProvider.tsx    # Auth context
│   │   ├── QueryProvider.tsx   # React Query wrapper
│   │   ├── SocketProvider.tsx  # Socket.io client
│   │   └── ThemeProvider.tsx   # Dark/light theme
│   └── ui/                     # Reusable primitives
│       ├── Avatar.tsx          # Avatar with status
│       ├── Button.tsx          # 4 variants
│       ├── Input.tsx           # Form input
│       ├── Modal.tsx           # Dialog overlay
│       └── Spinner.tsx         # Loading indicator
│
├── lib/
│   ├── api.ts                  # API client (axios)
│   ├── mockAuthStore.ts        # In-memory users
│   ├── mockChatStore.ts        # In-memory messages
│   └── mongodb.ts              # DB connection helper
│
└── lightsail/                  # AWS deployment config
```

## 🎨 Design System

### Brand Colors
```
brand-50:  #e0f2fe (lightest)
brand-100: #bae6fd
brand-200: #7dd3fc
brand-300: #38bdf8
brand-400: #0ea5e9
brand-500: #0284c7 (primary)
brand-600: #0369a1
brand-700: #075985
brand-800: #0c4a6e
brand-900: #082f49 (darkest)
```

### Component Variants

**Button:**
- `primary` - Blue, main actions
- `secondary` - Gray, cancel actions
- `ghost` - Transparent, menu items
- `danger` - Red, destructive actions

**Avatar Sizes:**
- `sm` - 8x8 (32px)
- `md` - 12x12 (48px)
- `lg` - 16x16 (64px)

**Status Indicators:**
- Green dot = online
- Yellow dot = away
- Gray dot = offline

### UI Patterns
- Glassmorphism: `bg-white/10 backdrop-blur-lg`
- Borders: `border border-white/20`
- Hover: `hover:bg-white/10`
- Text: `text-white` (primary), `text-white/70` (secondary)

## 🔌 Backend Integration Guide

### Mock Markers
All mock code is marked with:
```javascript
// Static code Backend team please change it to dynamic
```

Search for this comment to find areas needing real backend integration.

### API Endpoints

**Authentication:**
```typescript
POST /api/auth/register
  Body: { email, password, name }
  Returns: { user, token }

POST /api/auth/login
  Body: { email, password }
  Returns: { user, token }

GET /api/auth/me
  Headers: { Authorization: Bearer <token> }
  Returns: { user }

POST /api/auth/logout
  Returns: { success }
```

**Chat:**
```typescript
GET /api/chat/channels
  Returns: { channels: Channel[] }

POST /api/chat/channels
  Body: { name }
  Returns: { channel }

GET /api/chat/channels/[id]/messages
  Returns: { messages: Message[] }

POST /api/chat/channels/[id]/messages/send
  Body: { content }
  Returns: { message }
```

**Monitoring:**
```typescript
GET /api/health
  Returns: { status, uptime, version, services }

GET /api/metrics
  Returns: { activeConnections, totalMessages, averageLatency, ... }
```

### Socket.io Events

**Client Emits:**
```typescript
socket.emit('typing', { channelId, userId })
socket.emit('message:send', { channelId, content })
socket.emit('reaction:add', { messageId, emoji, userId })
```

**Client Listens:**
```typescript
socket.on('message:new', (message) => { /* Add to UI */ })
socket.on('user:typing', ({ userId, channelId }) => { /* Show indicator */ })
socket.on('user:online', ({ userId }) => { /* Update presence */ })
socket.on('user:offline', ({ userId }) => { /* Update presence */ })
socket.on('reaction:added', ({ messageId, emoji, userId }) => { /* Update reactions */ })
```

### Data Models

**User:**
```typescript
interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  status: 'active' | 'suspended';
  createdAt: string;
}
```

**Message:**
```typescript
interface Message {
  id: string;
  content: string;
  userId: string;
  channelId: string;
  createdAt: string;
  reactions?: Reaction[];
  attachments?: Attachment[];
}

interface Reaction {
  emoji: string;
  count: number;
  users: string[];
}

interface Attachment {
  name: string;
  size: number;
  type: string;
  url?: string;
}
```

**Channel:**
```typescript
interface Channel {
  id: string;
  name: string;
  memberCount?: number;
  createdAt: string;
}
```

## 🧪 Testing Strategy

### Unit Tests (To Implement)
```bash
npm test
```

Test files: `*.test.tsx` next to components

**Example:**
```typescript
// Button.test.tsx
import { render, fireEvent } from '@testing-library/react';
import { Button } from './Button';

test('calls onClick when clicked', () => {
  const handleClick = jest.fn();
  const { getByText } = render(<Button onClick={handleClick}>Click me</Button>);
  fireEvent.click(getByText('Click me'));
  expect(handleClick).toHaveBeenCalledTimes(1);
});
```

### E2E Tests (To Implement)
```bash
npx playwright test
```

**Example flow:**
1. Navigate to /login
2. Enter credentials
3. Click login button
4. Verify redirect to /chat/general
5. Send a message
6. Verify message appears

## 🚀 Deployment

### Environment Variables
```env
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_SOCKET_URL=wss://socket.example.com
MONGODB_URI=mongodb://...
JWT_SECRET=your-secret-key
```

### Build for Production
```bash
npm run build
npm start
```

### Docker
```bash
docker build -t chat-frontend .
docker run -p 3000:3000 chat-frontend
```

### AWS Lightsail
```bash
cd lightsail
./generate-deployment.sh
```

## 🔒 Security Checklist

- [ ] Replace mock auth with secure JWT
- [ ] Implement password hashing (bcrypt)
- [ ] Add CSRF tokens
- [ ] Rate limiting on API endpoints
- [ ] Input sanitization (XSS prevention)
- [ ] HTTPS only in production
- [ ] Secure cookie settings
- [ ] Content Security Policy headers
- [ ] Regular dependency updates

## 📊 Performance Optimization

### Current Optimizations
- React Server Components for static content
- Dynamic imports for large components
- Debounced typing indicators (500ms)
- Optimistic UI updates
- Lazy loading images
- Efficient re-renders with React.memo

### Future Improvements
- Virtual scrolling for long message lists
- Service Worker for offline support
- CDN for static assets
- Image optimization (WebP)
- Bundle size analysis
- Lighthouse score optimization

## 🐛 Known Issues

1. **Mock Data Resets:** In-memory stores reset on server restart
2. **No Persistence:** Messages/channels lost on refresh
3. **Single User:** Mock auth always uses userId='1'
4. **No Real-time:** Socket.io not connected to backend

These are expected in the mock implementation and will be resolved with backend integration.

## 🤝 Team Collaboration

### Git Workflow
```bash
# Create feature branch
git checkout -b feature/your-feature

# Commit with descriptive messages
git commit -m "feat: add message search"

# Push and create PR
git push origin feature/your-feature
```

### Code Style
- TypeScript for type safety
- ESLint for code quality
- Prettier for formatting
- Conventional commits

### Component Guidelines
1. Use TypeScript interfaces for props
2. Extract reusable logic into hooks
3. Keep components under 200 lines
4. Add ARIA labels for accessibility
5. Mark mock code with standard comment

## 📖 Additional Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [React Hook Form](https://react-hook-form.com/)
- [Recharts](https://recharts.org/)
- [Socket.io Client](https://socket.io/docs/v4/client-api/)

## 🙋 Support

For questions or issues:
1. Check this documentation
2. Review code comments
3. Contact the development team

---

**Last Updated:** November 24, 2025
**Version:** 1.0.0
**Status:** ✅ Frontend Complete, Awaiting Backend Integration
