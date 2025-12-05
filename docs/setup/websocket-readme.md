# ConnectBest Chat WebSocket API

AWS Serverless WebSocket API for real-time chat messaging using API Gateway + Lambda + DynamoDB.

## Architecture

- **API Gateway WebSocket API**: Manages WebSocket connections
- **Lambda Functions**: Handle connect, disconnect, and message routing
- **DynamoDB**: Stores active connections with channel/user mapping

## Deployment

### Prerequisites

```bash
# Install AWS SAM CLI
brew install aws-sam-cli  # macOS

# Or using pip
pip install aws-sam-cli
```

### Deploy

```bash
# Navigate to websocket-api directory
cd websocket-api

# Install Lambda dependencies
cd src/handlers && npm install && cd ../..

# Build and deploy
sam build
sam deploy --guided
```

### Configuration

After deployment, you'll get a WebSocket URL like:
```
wss://abc123xyz.execute-api.us-west-2.amazonaws.com/prod
```

Add this as a GitHub Secret:
```bash
gh secret set WEBSOCKET_URL --repo ConnectBest/chat --body "wss://your-api-id.execute-api.region.amazonaws.com/prod"
```

## Usage

### Frontend Connection

The frontend automatically connects when a user is authenticated:

```typescript
const socket = io(WEBSOCKET_URL, {
  query: {
    userId: session.user.id,
    channelId: currentChannel
  }
});
```

### Message Format

Send messages:
```json
{
  "action": "sendMessage",
  "channelId": "general",
  "message": "Hello, world!",
  "userId": "123",
  "userName": "John Doe"
}
```

Receive messages:
```json
{
  "type": "message",
  "channelId": "general",
  "message": "Hello, world!",
  "userId": "123",
  "userName": "John Doe",
  "timestamp": "2024-12-02T01:00:00.000Z"
}
```

## Cost Estimate

- API Gateway WebSocket: $1.00/million messages
- Lambda: Free tier (1M requests/month)
- DynamoDB: Free tier (25GB storage)

**Total for light academic use: ~$0-2/month**

## Monitoring

View logs in CloudWatch:
```bash
sam logs -n ConnectFunction --stack-name connectbest-websocket --tail
sam logs -n MessageFunction --stack-name connectbest-websocket --tail
```
