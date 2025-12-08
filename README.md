# 🧠 ConnectBest Chat

The **ConnectBest Chat Application** is a full-stack real-time chat platform with Next.js frontend and Flask backend, containerized and deployed to **AWS ECS Fargate** with multi-container architecture, HTTPS security, and secure credential management.

This application provides secure team communication with real-time messaging, file sharing, and authentication, deployed automatically using **GitHub Actions + AWS CDK** for infrastructure as code.

---

## 🏗️ System Architecture

### **Technology Stack**
- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, NextAuth.js
- **Backend**: Flask (Python 3.8+), Socket.IO, PyMongo
- **Database**: MongoDB Atlas (Cloud)
- **Real-time**: AWS Lambda + API Gateway WebSocket
- **Authentication**: NextAuth with Credentials + Google OAuth, JWT tokens, 2FA support
- **Infrastructure**: AWS ECS Fargate, Application Load Balancer, CloudWatch
- **Storage**: S3 (files), SES (email)
- **Deployment**: Docker containers → AWS ECR Public → AWS ECS via CDK

### **High-Level Architecture**

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Browser]
        MOBILE[Mobile App]
    end

    subgraph "CDN & Load Balancing"
        ROUTE53[Route 53]
        ALB[Application Load Balancer]
        CERT[SSL Certificate]
    end

    subgraph "AWS ECS Fargate"
        subgraph "ECS Task"
            FRONTEND[Next.js Frontend<br/>Port 3000]
            BACKEND[Flask Backend<br/>Port 5001]
        end
    end

    subgraph "Real-time Communication"
        APIGW[API Gateway WebSocket]
        LAMBDA_CONNECT[Connect Lambda]
        LAMBDA_MESSAGE[Message Lambda]
        LAMBDA_DISCONNECT[Disconnect Lambda]
        DYNAMO[DynamoDB<br/>Connections]
    end

    subgraph "External Services"
        MONGODB[MongoDB Atlas<br/>Primary Database]
        GOOGLE[Google OAuth]
    end

    subgraph "AWS Managed Services"
        S3[S3 Bucket<br/>File Storage]
        SES[SES<br/>Email Service]
        CLOUDWATCH[CloudWatch<br/>Monitoring]
        ECR[ECR<br/>Container Registry]
    end

    subgraph "CI/CD Pipeline"
        GITHUB[GitHub Actions]
        CDK[AWS CDK]
    end

    %% Client connections
    WEB --> ROUTE53
    MOBILE --> ROUTE53

    %% DNS and Load Balancing
    ROUTE53 --> ALB
    ALB --> FRONTEND
    ALB --> BACKEND

    %% Frontend/Backend communication
    FRONTEND -.->|API Calls| BACKEND
    FRONTEND -->|WebSocket| APIGW

    %% Real-time WebSocket flow
    APIGW --> LAMBDA_CONNECT
    APIGW --> LAMBDA_MESSAGE
    APIGW --> LAMBDA_DISCONNECT
    LAMBDA_CONNECT --> DYNAMO
    LAMBDA_MESSAGE --> DYNAMO
    LAMBDA_DISCONNECT --> DYNAMO

    %% Data persistence
    BACKEND --> MONGODB
    FRONTEND --> MONGODB

    %% External integrations
    FRONTEND --> GOOGLE
    BACKEND --> S3
    BACKEND --> SES

    %% Monitoring and deployment
    FRONTEND --> CLOUDWATCH
    BACKEND --> CLOUDWATCH
    GITHUB --> ECR
    GITHUB --> CDK
    CDK --> ALB
    CDK --> ECS

    style FRONTEND fill:#e1f5fe
    style BACKEND fill:#e8f5e8
    style MONGODB fill:#f3e5f5
    style APIGW fill:#fff3e0
```

### **AWS Infrastructure Components**

```mermaid
graph TB
    subgraph "VPC (2 AZs)"
        subgraph "Public Subnets"
            ALB[Application Load Balancer<br/>SSL Termination]
        end

        subgraph "Private Subnets"
            subgraph "ECS Cluster"
                TASK1[ECS Task 1<br/>Frontend + Backend]
                TASK2[ECS Task 2<br/>Frontend + Backend]
                TASK3[ECS Task 3<br/>Auto-scaled]
            end
        end
    end

    subgraph "Storage & Data"
        S3_FILES[S3 Bucket<br/>File Attachments]
        S3_LOGS[S3 Bucket<br/>ALB Access Logs]
        DYNAMO_WS[DynamoDB<br/>WebSocket Connections]
        MONGODB[MongoDB Atlas<br/>Application Data]
    end

    subgraph "Serverless WebSocket"
        APIGW_WS[API Gateway WebSocket]
        LAMBDA_FUNCS[Lambda Functions<br/>Connect/Message/Disconnect]
    end

    subgraph "Monitoring & Observability"
        CW_LOGS[CloudWatch Logs]
        CW_METRICS[CloudWatch Metrics]
        CW_ALARMS[CloudWatch Alarms]
        DASHBOARD[CloudWatch Dashboard]
    end

    subgraph "Email & Authentication"
        SES[Amazon SES<br/>Email Verification]
        GOOGLE_OAUTH[Google OAuth 2.0]
    end

    subgraph "CI/CD"
        ECR_PUB[ECR Public Registry]
        ECR_PRIV[ECR Private Registry]
        GITHUB[GitHub Actions]
    end

    %% Load balancer routing
    ALB -->|Port 3000| TASK1
    ALB -->|Port 5001| TASK1
    ALB -->|Auto-scale| TASK2
    ALB -->|Auto-scale| TASK3

    %% Data connections
    TASK1 --> MONGODB
    TASK1 --> S3_FILES
    TASK1 --> SES

    %% WebSocket architecture
    APIGW_WS --> LAMBDA_FUNCS
    LAMBDA_FUNCS --> DYNAMO_WS

    %% Monitoring
    TASK1 --> CW_LOGS
    ALB --> CW_METRICS
    ALB --> S3_LOGS
    CW_METRICS --> CW_ALARMS
    CW_METRICS --> DASHBOARD

    %% Authentication
    TASK1 --> GOOGLE_OAUTH

    %% Deployment
    GITHUB --> ECR_PUB
    GITHUB --> ECR_PRIV
    ECR_PUB --> TASK1
    ECR_PRIV --> TASK1

    style ALB fill:#ffeb3b
    style TASK1 fill:#4caf50
    style MONGODB fill:#ff9800
    style APIGW_WS fill:#2196f3
```

### **Data Flow Architecture**

```mermaid
sequenceDiagram
    participant User as User Browser
    participant ALB as Application Load Balancer
    participant Frontend as Next.js Frontend
    participant Backend as Flask Backend
    participant MongoDB as MongoDB Atlas
    participant WebSocket as API Gateway WebSocket
    participant Lambda as Lambda Functions
    participant DynamoDB as DynamoDB
    participant S3 as S3 Storage
    participant SES as Amazon SES

    %% Authentication Flow
    User->>ALB: HTTPS Request
    ALB->>Frontend: Route to Frontend
    Frontend->>Backend: POST /api/auth/login
    Backend->>MongoDB: Validate credentials
    MongoDB-->>Backend: User data
    Backend-->>Frontend: JWT token
    Frontend-->>User: Authenticated session

    %% Real-time Messaging
    User->>WebSocket: WebSocket connection
    WebSocket->>Lambda: Connect event
    Lambda->>DynamoDB: Store connection
    DynamoDB-->>Lambda: Confirmed
    Lambda-->>WebSocket: Connection established
    WebSocket-->>User: Connected

    User->>WebSocket: Send message
    WebSocket->>Lambda: Message event
    Lambda->>DynamoDB: Query channel connections
    DynamoDB-->>Lambda: Connection list
    Lambda->>Backend: Store message
    Backend->>MongoDB: Save message
    Lambda->>WebSocket: Broadcast to all connections
    WebSocket-->>User: Message delivered

    %% File Upload
    User->>Frontend: Upload file
    Frontend->>Backend: POST /api/upload
    Backend->>S3: Store file
    S3-->>Backend: File URL
    Backend->>MongoDB: Save file metadata
    Backend-->>Frontend: File uploaded
    Frontend-->>User: File available

    %% Email Verification
    User->>Frontend: Register account
    Frontend->>Backend: POST /api/auth/register
    Backend->>MongoDB: Create user
    Backend->>SES: Send verification email
    SES-->>User: Verification email
    User->>Frontend: Click verification link
    Frontend->>Backend: Verify email token
    Backend->>MongoDB: Update user status
    Backend-->>Frontend: Account verified
```

### **Authentication & Security Flow**

```mermaid
graph TB
    subgraph "Authentication Methods"
        LOGIN[Email/Password Login]
        GOOGLE[Google OAuth 2.0]
        MFA[Two-Factor Authentication]
    end

    subgraph "NextAuth.js Frontend"
        NEXTAUTH[NextAuth Session]
        JWT_FRONTEND[JWT Token Storage]
        SESSION_CHECK[Session Validation]
    end

    subgraph "Flask Backend"
        JWT_VERIFY[JWT Token Verification]
        DECORATORS[token_required Decorator]
        PERMISSIONS[Role-based Permissions]
    end

    subgraph "Data Protection"
        BCRYPT[Bcrypt Password Hashing]
        ENCRYPTION[Data Encryption at Rest]
        HTTPS[HTTPS/TLS Encryption]
    end

    %% Authentication flows
    LOGIN --> NEXTAUTH
    GOOGLE --> NEXTAUTH
    MFA --> NEXTAUTH

    %% Token management
    NEXTAUTH --> JWT_FRONTEND
    JWT_FRONTEND --> JWT_VERIFY
    JWT_VERIFY --> DECORATORS
    DECORATORS --> PERMISSIONS

    %% Security measures
    LOGIN --> BCRYPT
    NEXTAUTH --> HTTPS
    JWT_VERIFY --> ENCRYPTION

    style LOGIN fill:#e3f2fd
    style GOOGLE fill:#f3e5f5
    style JWT_FRONTEND fill:#e8f5e8
    style ENCRYPTION fill:#fff3e0
```

### **WebSocket Real-time Architecture**

```mermaid
graph LR
    subgraph "Client Connections"
        USER1[User 1 Browser]
        USER2[User 2 Browser]
        USER3[User 3 Mobile]
    end

    subgraph "AWS WebSocket Infrastructure"
        APIGW[API Gateway WebSocket<br/>wss://...execute-api.../prod]

        subgraph "Lambda Functions"
            CONNECT[Connect Handler<br/>Store connection]
            MESSAGE[Message Handler<br/>Broadcast to channel]
            DISCONNECT[Disconnect Handler<br/>Clean up connection]
        end

        DYNAMO[DynamoDB Table<br/>connectionId, userId, channelId<br/>TTL: 24 hours]
    end

    subgraph "Message Storage"
        MONGODB[MongoDB Atlas<br/>Persistent message history]
    end

    %% Connection establishment
    USER1 -->|WebSocket Connect| APIGW
    USER2 -->|WebSocket Connect| APIGW
    USER3 -->|WebSocket Connect| APIGW

    APIGW --> CONNECT
    CONNECT --> DYNAMO

    %% Message flow
    USER1 -->|Send Message| APIGW
    APIGW --> MESSAGE
    MESSAGE --> DYNAMO
    MESSAGE --> MONGODB

    %% Broadcasting
    MESSAGE -->|Query by channelId| DYNAMO
    MESSAGE -->|Broadcast via API Gateway| APIGW
    APIGW -->|Real-time delivery| USER1
    APIGW -->|Real-time delivery| USER2
    APIGW -->|Real-time delivery| USER3

    %% Disconnection
    USER1 -->|Disconnect| APIGW
    APIGW --> DISCONNECT
    DISCONNECT --> DYNAMO

    style APIGW fill:#2196f3
    style MESSAGE fill:#4caf50
    style DYNAMO fill:#ff9800
    style MONGODB fill:#9c27b0
```

### **Key Architecture Benefits**

| Feature | Implementation | Benefit |
|---------|---------------|---------|
| **High Availability** | Multi-AZ deployment, auto-scaling (1-3 tasks) | 99.9%+ uptime, fault tolerance |
| **Serverless Real-time** | Lambda + API Gateway WebSocket | Cost-effective, unlimited scale |
| **Container Orchestration** | ECS Fargate with ALB | Zero server management, blue-green deployments |
| **Stateless Design** | JWT tokens, external MongoDB | Horizontal scaling, session persistence |
| **CDN Integration** | CloudFront-ready static assets | Global performance optimization |
| **Security by Design** | HTTPS, JWT, OAuth, role-based access | Enterprise-grade security |
| **Observability** | CloudWatch metrics, logs, alarms | Proactive monitoring, debugging |
| **Cost Optimization** | Pay-per-use Lambda, efficient containers | Optimized for startup/small teams |

### **Infrastructure as Code**

```mermaid
graph TB
    subgraph "Source Control"
        REPO[GitHub Repository]
        BRANCH[Main Branch]
    end

    subgraph "CI/CD Pipeline"
        ACTIONS[GitHub Actions]
        OIDC[AWS OIDC Authentication]
        BUILD[Multi-stage Docker Build]
    end

    subgraph "Container Registry"
        ECR_PUB[ECR Public<br/>Global Distribution]
        ECR_PRIV[ECR Private<br/>Secure Storage]
    end

    subgraph "Infrastructure Deployment"
        CDK[AWS CDK TypeScript]
        CLOUDFORMATION[CloudFormation Stacks]
        RESOURCES[AWS Resources]
    end

    subgraph "Application Deployment"
        ECS_SERVICE[ECS Service Update]
        ROLLING[Rolling Deployment]
        HEALTH[Health Checks]
    end

    %% CI/CD Flow
    REPO --> ACTIONS
    BRANCH --> ACTIONS
    ACTIONS --> OIDC
    ACTIONS --> BUILD

    %% Container flow
    BUILD --> ECR_PUB
    BUILD --> ECR_PRIV

    %% Infrastructure flow
    ACTIONS --> CDK
    CDK --> CLOUDFORMATION
    CLOUDFORMATION --> RESOURCES

    %% Deployment flow
    ECR_PUB --> ECS_SERVICE
    ECS_SERVICE --> ROLLING
    ROLLING --> HEALTH

    style ACTIONS fill:#28a745
    style CDK fill:#17a2b8
    style ECS_SERVICE fill:#6f42c1
    style HEALTH fill:#fd7e14
```

### **Monitoring & Operations**

The application includes comprehensive observability through:

- **📊 Operations Dashboard** (`/ops`): Real-time system health, WebSocket monitoring, AWS integration
- **🏥 Health Checks**: Application health endpoints with git build information
- **📈 CloudWatch Metrics**: CPU, memory, request count, error rates, latency
- **🚨 CloudWatch Alarms**: Proactive alerting for high error rates, latency, low healthy hosts
- **📝 Centralized Logging**: ECS container logs, ALB access logs, Lambda function logs
- **🔍 WebSocket Health Monitoring**: Connection status, protocol validation, troubleshooting guidance

#### **Key Monitoring URLs**
- Application Health: `https://chat.connect-best.com/api/health`
- Operations Dashboard: `https://chat.connect-best.com/ops` (admin access required)
- CloudWatch Dashboard: Auto-generated URL in deployment outputs
- ALB Access Logs: S3 bucket with HTTP status codes and performance data

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
