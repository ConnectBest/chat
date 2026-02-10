# Backend Technology Stack - ConnectBest Chat

> **履歷參考文件 / Resume Reference Document**
> 本文件詳細列出此專案後端使用的所有網頁技術，適合撰寫履歷或技術簡介使用。

## 📋 概述 / Overview

ConnectBest Chat 是一個**生產級別的分散式即時通訊系統**，採用現代化的 Python Web 技術堆疊，結合微服務架構、事件驅動模式和雲端原生部署策略。

**ConnectBest Chat** is a **production-grade distributed real-time communication system** built with modern Python web technologies, featuring microservices architecture, event-driven patterns, and cloud-native deployment strategies.

---

## 🎯 核心技術堆疊 / Core Technology Stack

### 1️⃣ **Web 框架 / Web Framework**

#### **Flask 3.0.0**
- 輕量級 Python Web 框架，支援 WSGI 標準
- 提供靈活的請求處理和路由機制
- RESTful API 設計的主要框架
- **Resume Keywords**: Flask, Python Web Framework, WSGI, RESTful API

#### **Flask-RESTX 1.3.0**
- REST API 擴展框架，自動生成 Swagger/OpenAPI 文件
- 提供請求驗證、序列化和 API 命名空間管理
- 支援自動 API 文件生成和互動式測試界面
- **Resume Keywords**: REST API, Swagger, OpenAPI Specification, API Documentation

#### **Flask-CORS 4.0.0**
- 跨域資源共享 (CORS) 中間件
- 管理前後端分離架構的跨域請求
- 支援預檢請求和複雜 CORS 場景
- **Resume Keywords**: CORS, Cross-Origin Resource Sharing, Web Security

---

### 2️⃣ **即時通訊技術 / Real-Time Communication**

#### **Flask-SocketIO 5.3.5**
- WebSocket 集成框架，支援雙向即時通訊
- 實現發佈-訂閱 (Pub-Sub) 訊息模式
- 支援房間管理和廣播功能
- **Resume Keywords**: WebSocket, Real-time Communication, Socket.IO, Pub-Sub Pattern

#### **python-socketio 5.10.0**
- Socket.IO 協議的 Python 伺服器實作
- 支援多種傳輸協議 (WebSocket, Long Polling)
- 自動重連和心跳機制
- **Resume Keywords**: Socket.IO Server, Event-Driven Architecture, Bidirectional Communication

#### **eventlet 0.35.1**
- 高效能非同步網路庫
- 協程 (Coroutine) 基礎的並發處理
- WebSocket 連接的異步處理引擎
- **Resume Keywords**: Async Programming, Coroutines, High-Performance Networking, Concurrent Processing

---

### 3️⃣ **資料庫技術 / Database Technologies**

#### **MongoDB**
- NoSQL 文件型資料庫，支援高可用性和水平擴展
- 使用 MongoDB Atlas 雲端託管服務
- 副本集 (Replica Set) 配置確保資料可靠性
- **Resume Keywords**: MongoDB, NoSQL, Document Database, MongoDB Atlas, Distributed Database

#### **PyMongo 4.3.3**
- MongoDB 官方 Python 驅動程式
- 連接池管理優化資料庫性能
- 支援異步操作和批次處理
- **Resume Keywords**: PyMongo, Database Driver, Connection Pooling, Database Optimization

#### **MongoEngine 0.27.0**
- MongoDB 物件文件映射器 (ODM)
- 提供類似 ORM 的模型定義和查詢 API
- 資料驗證和模式管理
- **Resume Keywords**: ODM (Object Document Mapper), Database Modeling, Schema Validation

#### **DynamoDB** (AWS Lambda WebSocket)
- 無伺服器鍵值存儲，用於 WebSocket 連接狀態管理
- TTL (Time To Live) 自動清理過期連接
- 毫秒級讀寫延遲
- **Resume Keywords**: DynamoDB, Serverless Database, NoSQL, AWS, Key-Value Store

---

### 4️⃣ **身份驗證與安全 / Authentication & Security**

#### **JWT (PyJWT 2.8.0)**
- JSON Web Token 實作，支援無狀態身份驗證
- Token 簽名驗證和過期管理
- 跨服務的安全令牌傳遞
- **Resume Keywords**: JWT, Token-Based Authentication, Stateless Authentication, Security

#### **bcrypt 4.1.2**
- 密碼哈希和驗證庫
- 防止彩虹表攻擊的加鹽哈希
- 可調整的工作因子 (Work Factor)
- **Resume Keywords**: Password Hashing, bcrypt, Cryptography, Security Best Practices

#### **Two-Factor Authentication (2FA)**
- **pyotp 2.9.0**: TOTP (時間基礎一次性密碼) 實作
- **qrcode 7.4.2**: QR 碼生成用於 2FA 設定
- Google Authenticator 相容
- **Resume Keywords**: Two-Factor Authentication (2FA), TOTP, Multi-Factor Authentication (MFA), Security

#### **OAuth 2.0 Integration**
- Google OAuth 2.0 登入集成
- 第三方身份提供者整合
- **Resume Keywords**: OAuth 2.0, Social Login, Google Sign-In, Identity Provider Integration

---

### 5️⃣ **雲端服務與部署 / Cloud Services & Deployment**

#### **AWS Services**

**AWS ECS Fargate**
- 無伺服器容器編排服務
- 自動擴展 (Auto Scaling) 配置 (1-3 實例)
- 多可用區 (Multi-AZ) 高可用部署
- **Resume Keywords**: AWS ECS, Fargate, Container Orchestration, Serverless Compute

**AWS Lambda**
- Serverless 函數用於 WebSocket 連接管理
- 事件驅動的擴展和計費
- **Resume Keywords**: AWS Lambda, Serverless Functions, Event-Driven Architecture, FaaS

**AWS API Gateway (WebSocket)**
- 管理型 WebSocket API 服務
- 無限制並發連接支援
- 自動路由和連接管理
- **Resume Keywords**: AWS API Gateway, WebSocket API, Managed WebSocket, Serverless API

**Application Load Balancer (ALB)**
- Layer 7 負載均衡器
- 基於路徑的路由和健康檢查
- SSL/TLS 終止
- **Resume Keywords**: Load Balancer, ALB, Traffic Distribution, High Availability

**AWS S3**
- 檔案上傳和存儲服務
- 無限擴展的物件存儲
- **Resume Keywords**: AWS S3, Object Storage, File Upload, Cloud Storage

**Amazon CloudWatch**
- 日誌管理、指標監控和告警
- 分散式系統可觀測性
- **Resume Keywords**: CloudWatch, Monitoring, Logging, Observability, Metrics

**AWS ECR (Elastic Container Registry)**
- Docker 映像檔儲存和版本管理
- 私有容器註冊表
- **Resume Keywords**: AWS ECR, Container Registry, Docker Images, CI/CD

#### **boto3 1.34.0**
- AWS Python SDK
- 程式化存取 AWS 服務 (S3, CloudWatch, DynamoDB)
- **Resume Keywords**: AWS SDK, boto3, Cloud Integration, Infrastructure as Code

---

### 6️⃣ **容器化與 CI/CD / Containerization & CI/CD**

#### **Docker**
- 多階段建置 (Multi-stage Build) 優化映像大小
- Docker Compose 用於本地開發環境
- 容器化應用部署
- **Resume Keywords**: Docker, Containerization, Multi-stage Builds, Docker Compose

#### **GitHub Actions**
- GitOps CI/CD 流水線
- 自動化建置、測試和部署
- 藍綠部署策略
- **Resume Keywords**: GitHub Actions, CI/CD, GitOps, Automated Deployment, Continuous Integration

#### **AWS CDK (Cloud Development Kit)**
- TypeScript 編寫的基礎設施即代碼 (IaC)
- 型別安全的基礎設施定義
- 可重現的基礎設施部署
- **Resume Keywords**: AWS CDK, Infrastructure as Code (IaC), CloudFormation, Infrastructure Automation

---

### 7️⃣ **資料驗證與序列化 / Data Validation & Serialization**

#### **Marshmallow 3.20.1**
- 物件序列化和反序列化框架
- Schema 定義和資料驗證
- API 請求/回應的資料轉換
- **Resume Keywords**: Data Validation, Schema Validation, Serialization, API Design

#### **email-validator 2.1.0**
- 電子郵件格式驗證
- RFC 5322 標準相容
- **Resume Keywords**: Input Validation, Email Validation, Data Integrity

---

### 8️⃣ **HTTP 客戶端與整合 / HTTP Client & Integration**

#### **requests 2.31.0**
- Python HTTP 客戶端庫
- 用於第三方 API 整合 (Google OAuth, Cloudinary)
- RESTful API 消費
- **Resume Keywords**: HTTP Client, API Integration, REST Client, Third-party Integration

#### **certifi 2023.11.17**
- SSL 證書驗證
- 確保 HTTPS 連接安全
- **Resume Keywords**: SSL/TLS, Certificate Validation, Secure Communications

---

### 9️⃣ **生產環境伺服器 / Production Server**

#### **Gunicorn 21.2.0**
- Python WSGI HTTP 伺服器
- 多工作進程管理
- 生產環境部署標準
- 與 eventlet worker 整合支援 WebSocket
- **Resume Keywords**: Gunicorn, WSGI Server, Production Deployment, Process Management

---

### 🔟 **測試框架 / Testing Framework**

#### **pytest 7.4.3**
- Python 測試框架
- 測試驅動開發 (TDD) 實踐
- **Resume Keywords**: pytest, Unit Testing, Test-Driven Development (TDD), Software Testing

#### **pytest-flask 1.3.0**
- Flask 應用測試工具
- 測試客戶端和 fixture 支援
- **Resume Keywords**: Integration Testing, Flask Testing, API Testing

#### **pytest-cov 4.1.0**
- 程式碼覆蓋率報告
- 測試品質指標
- **Resume Keywords**: Code Coverage, Test Metrics, Quality Assurance

---

## 🏗️ 架構模式 / Architectural Patterns

### ✅ 實作的設計模式與最佳實踐 / Implemented Design Patterns & Best Practices

1. **微服務架構 (Microservices Architecture)**
   - 前端、後端、WebSocket 服務獨立部署
   - 服務間透過 REST API 和 WebSocket 通訊

2. **事件驅動架構 (Event-Driven Architecture)**
   - 發佈-訂閱訊息模式
   - 異步訊息廣播

3. **無狀態設計 (Stateless Design)**
   - JWT Token 驗證
   - 外部狀態存儲 (MongoDB, DynamoDB)

4. **應用程式工廠模式 (Application Factory Pattern)**
   - Flask 工廠函數創建應用實例
   - 支援多環境配置

5. **藍圖模組化 (Blueprint Modularization)**
   - 路由按功能領域分離
   - 清晰的程式碼組織

6. **中間件模式 (Middleware Pattern)**
   - CORS 處理
   - JWT 驗證裝飾器
   - 請求日誌記錄

7. **連接池模式 (Connection Pooling)**
   - MongoDB 連接池優化
   - 資料庫性能提升

8. **健康檢查端點 (Health Check Endpoints)**
   - ALB 健康檢查
   - 服務可用性監控

---

## 📊 技術能力總結 / Technical Capabilities Summary

### Backend Development Skills
✅ **Python Web Development**: Flask, REST API design, WSGI servers  
✅ **Real-Time Systems**: WebSocket, Socket.IO, Event-driven architecture  
✅ **Database Management**: MongoDB, NoSQL modeling, DynamoDB  
✅ **Authentication & Security**: JWT, OAuth 2.0, 2FA/TOTP, bcrypt, password security  
✅ **Cloud Computing**: AWS (ECS, Lambda, API Gateway, S3, CloudWatch, ECR)  
✅ **Containerization**: Docker, multi-stage builds, container orchestration  
✅ **CI/CD**: GitHub Actions, automated deployment, GitOps  
✅ **Infrastructure as Code**: AWS CDK, CloudFormation  
✅ **API Design**: RESTful APIs, OpenAPI/Swagger documentation  
✅ **Testing**: pytest, unit testing, integration testing, code coverage  
✅ **Microservices**: Service decomposition, inter-service communication  
✅ **Distributed Systems**: Load balancing, auto-scaling, fault tolerance  

---

## 📝 履歷建議撰寫範例 / Resume Writing Examples

### 專案經驗描述範例 / Project Experience Example

**中文版本:**
```
專案：ConnectBest Chat - 分散式即時通訊系統
技術棧：Python, Flask, Socket.IO, MongoDB, AWS (ECS/Lambda/API Gateway), Docker
- 使用 Flask 3.0 和 Flask-RESTX 建構 RESTful API 後端，整合 Swagger 自動文件生成
- 實作 Flask-SocketIO 與 AWS API Gateway WebSocket 的雙協議即時通訊系統
- 採用 JWT 和 bcrypt 實現安全的無狀態身份驗證，整合 TOTP 雙因素認證
- 設計 MongoDB 分散式資料庫架構，使用 PyMongo 和 MongoEngine 進行資料建模
- 建立 AWS ECS Fargate 容器化部署，配置 ALB 負載均衡和自動擴展 (1-3 實例)
- 開發 AWS Lambda 無伺服器函數處理 WebSocket 連接，整合 DynamoDB 狀態管理
- 使用 AWS CDK (TypeScript) 實作基礎設施即代碼，實現可重現的雲端部署
- 建立 GitHub Actions CI/CD 流水線，實現自動化建置、測試和藍綠部署
- 整合 CloudWatch 實現分散式系統監控、日誌管理和告警機制
```

**English Version:**
```
Project: ConnectBest Chat - Distributed Real-Time Communication System
Tech Stack: Python, Flask, Socket.IO, MongoDB, AWS (ECS/Lambda/API Gateway), Docker
- Built RESTful API backend using Flask 3.0 and Flask-RESTX with auto-generated Swagger documentation
- Implemented dual-protocol real-time communication with Flask-SocketIO and AWS API Gateway WebSocket
- Developed secure stateless authentication using JWT and bcrypt with TOTP-based 2FA integration
- Designed distributed MongoDB database architecture using PyMongo and MongoEngine for data modeling
- Deployed containerized application on AWS ECS Fargate with ALB load balancing and auto-scaling (1-3 instances)
- Developed serverless AWS Lambda functions for WebSocket connection management with DynamoDB state store
- Implemented Infrastructure as Code using AWS CDK (TypeScript) for reproducible cloud deployments
- Established GitHub Actions CI/CD pipeline for automated build, test, and blue-green deployments
- Integrated CloudWatch for distributed systems monitoring, logging, and alerting
```

### 技能清單範例 / Skills List Example

**Backend Technologies:**
- **Languages**: Python 3.8+
- **Frameworks**: Flask, Flask-RESTX, Flask-SocketIO
- **Databases**: MongoDB, MongoDB Atlas, PyMongo, MongoEngine, DynamoDB
- **Real-Time**: Socket.IO, WebSocket, Event-Driven Architecture
- **Authentication**: JWT (PyJWT), bcrypt, OAuth 2.0, 2FA/TOTP
- **Cloud**: AWS (ECS, Fargate, Lambda, API Gateway, S3, CloudWatch, ECR, ALB)
- **DevOps**: Docker, GitHub Actions, AWS CDK, Infrastructure as Code
- **API Design**: REST, OpenAPI/Swagger, API Documentation
- **Testing**: pytest, Unit Testing, Integration Testing

---

## 🔗 相關資源 / Related Resources

- **完整專案文件**: [README.md](./README.md)
- **API 文件**: Swagger UI 可於 `http://localhost:5001/docs` 存取
- **後端原始碼**: [backend/](./backend/)
- **部署架構**: [infrastructure/](./infrastructure/)
- **CI/CD 流水線**: [.github/workflows/](./.github/workflows/)

---

## 📧 其他說明 / Additional Notes

此技術堆疊文件基於專案的實際實作和 `backend/requirements.txt` 檔案。所有版本號碼和技術描述均經過驗證，可直接用於履歷撰寫或技術面試準備。

This technology stack document is based on actual project implementation and the `backend/requirements.txt` file. All version numbers and technical descriptions have been verified and can be directly used for resume writing or technical interview preparation.

---

**最後更新 / Last Updated**: 2026-02-10  
**維護者 / Maintainer**: ConnectBest Team
