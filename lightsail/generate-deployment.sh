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
        "MONGODB_URI": "${MONGODB_URI}"
      }
    }
  },
  "publicEndpoint": {
    "containerName": "chat",
    "containerPort": 8080,
    "healthCheck": {
      "path": "/",
      "intervalSeconds": 60,
      "timeoutSeconds": 5,
      "healthyThreshold": 2,
      "unhealthyThreshold": 3
    }
  }
}
EOF
