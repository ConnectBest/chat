#!/bin/bash
set -e

echo "🚀 Deploying ConnectBest WebSocket API..."

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Navigate to websocket-api directory
cd "$(dirname "$0")"

# Install dependencies
echo -e "${BLUE}📦 Installing Lambda dependencies...${NC}"
cd src/handlers
npm install
cd ../..

# Build
echo -e "${BLUE}🔨 Building SAM application...${NC}"
sam build

# Deploy
echo -e "${BLUE}☁️  Deploying to AWS...${NC}"
sam deploy \
  --stack-name connectbest-websocket \
  --capabilities CAPABILITY_IAM \
  --region us-west-2 \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset

# Get WebSocket URL
WEBSOCKET_URL=$(aws cloudformation describe-stacks \
  --stack-name connectbest-websocket \
  --region us-west-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`WebSocketURL`].OutputValue' \
  --output text)

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo -e "${GREEN}WebSocket URL:${NC} $WEBSOCKET_URL"
echo ""
echo "📝 Next steps:"
echo "1. Add this URL as a GitHub Secret:"
echo ""
echo "   gh secret set WEBSOCKET_URL --repo ConnectBest/chat --body \"$WEBSOCKET_URL\""
echo ""
echo "2. Update your .env.local for local development:"
echo ""
echo "   NEXT_PUBLIC_WEBSOCKET_URL=$WEBSOCKET_URL"
echo ""
