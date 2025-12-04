#!/bin/bash
# Generate Lightsail deployment config with secrets from GitHub
cat > lightsail/deployment.json <<EOF
{
  "containers": {
    "chat": {
      "image": "839776274679.dkr.ecr.us-west-2.amazonaws.com/chat:latest",
      "ports": {
        "8080": "HTTP"
      },
      "environment": {
        "NODE_ENV": "production",
        "HOST": "0.0.0.0",
        "PORT": "8080",
        "MONGODB_URI": "${MONGODB_URI}",
        "NEXTAUTH_URL": "${NEXTAUTH_URL:-https://chat-app.lightsail.aws}",
        "NEXTAUTH_SECRET": "${NEXTAUTH_SECRET}",
        "GOOGLE_CLIENT_ID": "${GOOGLE_CLIENT_ID:-}",
        "GOOGLE_CLIENT_SECRET": "${GOOGLE_CLIENT_SECRET:-}",
        "EMAIL_HOST": "${EMAIL_HOST:-smtp.gmail.com}",
        "EMAIL_PORT": "${EMAIL_PORT:-587}",
        "EMAIL_USER": "${EMAIL_USER:-}",
        "EMAIL_PASSWORD": "${EMAIL_PASSWORD:-}",
        "EMAIL_FROM": "${EMAIL_FROM:-noreply@connectbest.com}",
        "NEXT_PUBLIC_WEBSOCKET_URL": "${NEXT_PUBLIC_WEBSOCKET_URL:-}"
      }
    }
  },
  "publicEndpoint": {
    "containerName": "chat",
    "containerPort": 8080,
    "healthCheck": {
      "path": "/api/health",
      "intervalSeconds": 60,
      "timeoutSeconds": 5,
      "healthyThreshold": 2,
      "unhealthyThreshold": 3
    }
  }
}
EOF
