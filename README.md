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