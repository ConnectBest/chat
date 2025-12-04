# 🧠 ConnectBest Chat

The **ConnectBest Chat microservice** is a lightweight Python (Flask) API containerized and published automatically to **Amazon ECR Public** under the `connectbest` namespace.

This service provides a simple REST endpoint returning `"Hello from ConnectBest 👋"` and serves as part of a broader collection of ConnectBest microservices (`chat`, `summary`, `auth`, etc.), each built and deployed independently using **GitHub Actions + AWS OIDC** for secure, keyless CI/CD.

---

## 📦 Architecture Overview

| Layer | Technology | Purpose |
|-------|-------------|----------|
| **App** | Flask (Python 3.12) | Minimal REST API |
| **Container** | Docker + Gunicorn | Production-ready image |
| **CI/CD** | GitHub Actions + AWS OIDC | Secure, keyless publishing |
| **Registry** | Amazon ECR Public (`public.ecr.aws/connectbest/chat`) | Global distribution |
| **IAM Auth** | GitHub → AWS OIDC | Removes need for static AWS keys |

---

## 🧰 Local Development

### Prerequisites
- Docker 24+  
- Python 3.12+ (optional, for manual testing)
- AWS CLI (optional, for debugging)

### Run Locally
```bash
docker build -t connectbest-chat:dev .
docker run -p 8080:8080 connectbest-chat:dev
```

---

## 🗂 Project Structure

The repository follows a monorepo-style layout, containing the frontend (Next.js), backend (Flask), and WebSocket service. Below is an overview of the main folders and their purpose:

chat/
├── app/                       # Next.js App Router (frontend UI + API routes)
│   ├── (auth)/                # Authentication pages (login, register, forgot, verify-email)
│   ├── (app)/                 # Protected pages (chat, profile, admin, ops)
│   ├── api/                   # API route handlers (mostly proxies to Flask backend)
│   └── globals.css            # Global styles
│
├── components/                # React components
│   ├── chat/                  # Chat UI (sidebar, messages, threads, emoji picker, uploads)
│   ├── providers/             # Global context providers (auth, socket, query, theme)
│   └── ui/                    # Reusable UI components (buttons, inputs, modals, avatars)
│
├── lib/                       # Frontend utilities and helpers
│   ├── api.ts                 # Axios client wrapper
│   ├── apiConfig.ts           # API configuration and endpoints
│   ├── auth.ts                # Authentication helpers
│   └── mongodb.ts             # MongoDB client (mock for frontend)
│
├── backend/                   # Flask backend service
│   ├── app.py                 # Main Flask entrypoint
│   ├── config.py              # App configuration + environment variables
│   ├── init_db.py             # Database initialization script
│   ├── routes/                # API route modules (auth, channels, messages, upload, etc.)
│   ├── models/                # MongoDB models (users, channels, messages, threads, files, etc.)
│   ├── utils/                 # Helpers (auth, email, validators, 2FA, OAuth)
│   └── scripts/               # Schema export, migration, comparison tools
│
├── websocket-api/             # AWS WebSocket API (SAM + Lambda)
│   ├── template.yaml          # WebSocket infrastructure template
│   └── src/handlers/          # Lambda handlers for connect/disconnect/message
│
├── .github/workflows/         # CI/CD pipelines (build, publish, OpenAPI lint)
│
├── Dockerfile                 # Multi-stage Docker build (Next.js → standalone server)
├── docker-compose.yml         # Optional local orchestration for backend + DB
├── next.config.js             # Next.js configuration
├── tailwind.config.js         # TailwindCSS configuration
├── tsconfig.json              # TypeScript config
└── README.md                  # Project root documentation


This structure enables full-stack development inside a single repository while maintaining clear separation between frontend, backend, and infrastructure layers.

---

## 📚 Documentation

The following guides provide detailed instructions for development, testing, deployment, authentication, backend requirements, and architecture across the ConnectBest Chat system.

### 🧰 Development & Architecture

- [MONOREPO_README.md](./MONOREPO_README.md) — Monorepo structure overview  
- [FRONTEND_DOCS.md](./FRONTEND_DOCS.md) — Frontend architecture, components, and design patterns  
- [BACKEND_API_REQUIREMENTS.md](./BACKEND_API_REQUIREMENTS.md) — Required backend endpoints & API specifications  
- [AUTHENTICATION_GUIDE.md](./AUTHENTICATION_GUIDE.md) — JWT, session handling, Google OAuth, and 2FA  
- [EMAIL_VERIFICATION_GUIDE.md](./EMAIL_VERIFICATION_GUIDE.md) — Email verification workflow  
- [CLAUDE.md](./CLAUDE.md) — Internal development guide for Claude Code (AI coding assistant)  
- [DATABASE_AI_REQUIREMENTS.md](./DATABASE_AI_REQUIREMENTS.md) — AI-related database schema expectations  
- [DATABASE_AI_REQUIREMENTS_MONGODB.md](./DATABASE_AI_REQUIREMENTS_MONGODB.md) — MongoDB schema design for AI features  

### 🧪 Testing & Static Data

- [TESTING_GUIDE.md](./TESTING_GUIDE.md) — Manual testing flows  
- [STATIC_DATA_LOCATIONS.md](./STATIC_DATA_LOCATIONS.md) — Static/mock data locations that require backend integration  

### ⚙️ Deployment

- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) — Full deployment instructions  
- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) — Deployment readiness checklist  
- [SINGLE_CONTAINER_DEPLOYMENT.md](./SINGLE_CONTAINER_DEPLOYMENT.md) — Single-container deployment steps  

### 🔐 Authentication & OAuth

- [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md) — Google OAuth credentials setup and integration  

### 📝 Engineering Workflow

- [PRE_MERGE_CHECKLIST.md](./PRE_MERGE_CHECKLIST.md) — Pre-merge requirements  
- [PR_CLEANUP_SUMMARY.md](./PR_CLEANUP_SUMMARY.md) — Code cleanup and PR quality checklist  

### 📊 Comparisons / Analysis

- [SLACK_COMPARISON.md](./SLACK_COMPARISON.md) — Comparison with Slack