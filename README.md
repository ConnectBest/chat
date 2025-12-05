# 🧠 ConnectBest Chat

The **ConnectBest Chat Application** is a full-stack real-time chat platform with Next.js frontend and Flask backend, containerized and deployed to **AWS ECS Fargate** with multi-container architecture, HTTPS security, and secure credential management.

This application provides secure team communication with real-time messaging, file sharing, and authentication, deployed automatically using **GitHub Actions + AWS CDK** for infrastructure as code.

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
```
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
```

This structure enables full-stack development inside a single repository while maintaining clear separation between frontend, backend, and infrastructure layers.

---

## 📚 Documentation

Complete documentation is available in the [`docs/`](docs/) directory, organized by topic:

- **🚀 [Setup & Getting Started](docs/setup/)** - Installation, configuration, and first-time setup guides
- **🏗️ [Architecture & Design](docs/architecture/)** - Technical architecture, database design, and component structure
- **🔐 [Authentication & Security](docs/authentication/)** - JWT, OAuth, 2FA, and security implementation
- **🛠️ [Development](docs/development/)** - Testing, debugging, schema migration, and development workflows
- **🚀 [Deployment](docs/deployment/)** - Production deployment guides and checklists
- **📡 [API Documentation](docs/api/)** - Complete API reference and endpoint specifications
- **📊 [Diagrams](docs/diagrams/)** - Visual architecture diagrams and flow charts

### Quick Links
- **New Developer?** Start with [docs/setup/MONOREPO_README.md](docs/setup/MONOREPO_README.md)
- **Backend Setup?** Follow [docs/setup/backend-readme.md](docs/setup/backend-readme.md)
- **Deployment?** Check [docs/deployment/DEPLOYMENT_GUIDE.md](docs/deployment/DEPLOYMENT_GUIDE.md)
- **API Reference?** See [docs/api/BACKEND_API_REQUIREMENTS.md](docs/api/BACKEND_API_REQUIREMENTS.md)
