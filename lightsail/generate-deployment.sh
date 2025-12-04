#!/bin/bash
# Generate Lightsail deployment config with secrets from GitHub

# Generate secure keys if not provided
FLASK_SECRET_KEY=${FLASK_SECRET_KEY:-$(openssl rand -base64 32)}
JWT_SECRET_KEY=${JWT_SECRET_KEY:-$(openssl rand -base64 32)}

cat > lightsail/deployment.json <<EOF
{
  "containers": {
    "chat": {
      "image": "839776274679.dkr.ecr.us-west-2.amazonaws.com/chat:latest",
      "ports": {
        "8080": "HTTP",
        "5001": "HTTP"
      },
      "environment": {
        "NODE_ENV": "production",
        "HOST": "0.0.0.0",
        "PORT": "8080",
        "FLASK_ENV": "production",
        "DEBUG": "False",
        "SECRET_KEY": "${FLASK_SECRET_KEY}",
        "JWT_SECRET_KEY": "${JWT_SECRET_KEY}",
        "JWT_EXPIRATION_HOURS": "168",
        "MONGODB_URI": "${MONGODB_URI}",
        "MONGODB_DB_NAME": "chatapp",
        "CORS_ORIGINS": "https://chat-app.efr21as675de2.us-west-2.cs.amazonlightsail.com",
        "FRONTEND_URL": "https://chat-app.efr21as675de2.us-west-2.cs.amazonlightsail.com",
        "NEXTAUTH_URL": "${NEXTAUTH_URL:-https://chat-app.efr21as675de2.us-west-2.cs.amazonlightsail.com}",
        "NEXTAUTH_SECRET": "${NEXTAUTH_SECRET}",
        "GOOGLE_CLIENT_ID": "${GOOGLE_CLIENT_ID:-}",
        "GOOGLE_CLIENT_SECRET": "${GOOGLE_CLIENT_SECRET:-}",
        "GOOGLE_REDIRECT_URI": "https://chat-app.efr21as675de2.us-west-2.cs.amazonlightsail.com/api/auth/google/callback",
        "EMAIL_HOST": "${EMAIL_HOST:-smtp.gmail.com}",
        "EMAIL_PORT": "${EMAIL_PORT:-587}",
        "EMAIL_USER": "${EMAIL_USER:-}",
        "EMAIL_PASSWORD": "${EMAIL_PASSWORD:-}",
        "EMAIL_FROM": "${EMAIL_FROM:-noreply@connectbest.com}",
        "NEXT_PUBLIC_WEBSOCKET_URL": "${NEXT_PUBLIC_WEBSOCKET_URL:-}",
        "MAX_CONTENT_LENGTH": "52428800",
        "UPLOAD_FOLDER": "static/uploads"
      },
      "command": []
    }
  },
  "publicEndpoint": {
    "containerName": "chat",
    "containerPort": 8080,
    "healthCheck": {
      "path": "/api/health",
      "intervalSeconds": 60,
      "timeoutSeconds": 30,
      "healthyThreshold": 2,
      "unhealthyThreshold": 8
    }
  }
}
EOF
