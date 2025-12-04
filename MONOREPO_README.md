# ConnectBest Chat - Full Stack Application

A production-ready real-time chat application built with **Next.js 15** (frontend) and **Flask** (backend).

## 🏗️ Monorepo Structure

```
chat/
├── app/                     # Next.js 15 Frontend (App Router)
├── components/              # React components
├── lib/                     # API configuration & utilities
├── backend/                 # Flask Backend API
│   ├── routes/              # API endpoints
│   ├── models/              # MongoDB models
│   ├── utils/               # Helper functions
│   └── app.py              # Main Flask application
└── docs/                    # Documentation
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ and npm
- **Python** 3.8+
- **MongoDB** instance running

### Frontend Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local:
# NEXT_PUBLIC_API_URL=http://localhost:5001
# NEXT_PUBLIC_WS_URL=ws://localhost:5001

# Run development server
npm run dev
```

Frontend: **http://localhost:8080**

### Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with MongoDB URI, JWT secrets, etc.

# Run Flask server
python app.py
```

Backend API: **http://localhost:5001**

---

## 🌟 Features

### Frontend
- ✅ Next.js 15 with App Router & TypeScript
- ✅ Real-time messaging (WebSocket)
- ✅ Admin dashboard with analytics
- ✅ Google OAuth & 2FA
- ✅ File uploads (images/documents)
- ✅ Channel & Direct Messages
- ✅ Environment-based configuration

### Backend
- ✅ Flask REST API with MongoDB
- ✅ JWT authentication
- ✅ Socket.IO real-time updates
- ✅ Google OAuth 2.0
- ✅ Two-Factor Authentication
- ✅ Production-ready CORS
- ✅ File upload handling

---

## 📦 Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 15, TypeScript, Tailwind CSS |
| **Backend** | Flask, Python 3.8+ |
| **Database** | MongoDB |
| **Real-time** | Socket.IO |
| **Auth** | JWT, Google OAuth, 2FA |

---

## 🔐 Authentication

1. **Email/Password** - Traditional auth
2. **Google OAuth** - Social login
3. **Two-Factor Auth (2FA)** - QR code based

Admin Dashboard: `/admin`

---

## 📖 Documentation

- [Production Deployment](PRODUCTION_DEPLOYMENT.md)
- [Frontend Docs](FRONTEND_DOCS.md)
- [Backend API Reference](backend/API_REFERENCE.md)
- [Authentication Guide](AUTHENTICATION_GUIDE.md)
- [Google OAuth Setup](GOOGLE_OAUTH_SETUP.md)
- [Database Schema](DATABASE_SCHEMA.md)

---

## 🚢 Production Deployment

**Frontend Build:**
```bash
npm run build
npm start  # Port 8080
```

**Backend (Gunicorn):**
```bash
gunicorn -k geventwebsocket.gunicorn.workers.GeventWebSocketWorker -w 1 app:app
```

Configure environment variables for production URLs and secure secrets.

---

## 🔑 Environment Variables

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:5001
NEXT_PUBLIC_WS_URL=ws://localhost:5001
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
```

### Backend (.env)
```env
MONGODB_URI=mongodb://localhost:27017/chatapp
JWT_SECRET_KEY=your-super-secret-jwt-key
SECRET_KEY=your-flask-secret-key
BACKEND_URL=http://localhost:5001
FRONTEND_URL=http://localhost:8080
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing`
5. Open Pull Request

---

**Built with ❤️ | Next.js + Flask**
