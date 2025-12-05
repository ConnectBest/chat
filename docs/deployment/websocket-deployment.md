# WebSocket Deployment Guide

## Overview

This guide covers deploying the AWS serverless WebSocket infrastructure for ConnectBest Chat real-time messaging.

**Architecture:**
- **API Gateway WebSocket**: Manages WebSocket connections
- **Lambda Functions**: Handle connect, disconnect, and message routing
- **DynamoDB**: Stores active connections with user/channel mapping

**Cost:** ~$0-2/month for academic demonstration use

---

## Prerequisites

1. **AWS SAM CLI** installed:
   ```bash
   # macOS
   brew install aws-sam-cli

   # Or using pip
   pip install aws-sam-cli
   ```

2. **AWS Credentials** configured with appropriate permissions:
   ```bash
   aws configure --profile personal-admin
   ```

3. **Permissions needed:**
   - Lambda: Create/Update functions
   - API Gateway: Create/Manage WebSocket APIs
   - DynamoDB: Create/Manage tables
   - CloudFormation: Create/Update stacks
   - IAM: Create roles and policies

---

## Step 1: Deploy WebSocket Infrastructure

Navigate to the websocket-api directory and run the deployment script:

```bash
cd websocket-api
./deploy.sh
```

This script will:
1. Install Lambda dependencies
2. Build the SAM application
3. Deploy to AWS CloudFormation
4. Output the WebSocket URL

**Expected output:**
```
✅ Deployment complete!

WebSocket URL: wss://abc123xyz.execute-api.us-west-2.amazonaws.com/prod
```

**Manual deployment** (if you prefer more control):
```bash
cd websocket-api

# Install dependencies
cd src/handlers && npm install && cd ../..

# Build
sam build

# Deploy with guided prompts
sam deploy --guided
```

During guided deployment, use these settings:
- Stack name: `connectbest-websocket`
- Region: `us-west-2`
- Confirm changes: `Y`
- Allow SAM CLI IAM role creation: `Y`
- Save arguments to configuration: `Y`

---

## Step 2: Add WebSocket URL to GitHub Secrets

After deployment, add the WebSocket URL as a GitHub secret:

```bash
# The URL from Step 1
gh secret set NEXT_PUBLIC_WEBSOCKET_URL \
  --repo ConnectBest/chat \
  --body "wss://your-api-id.execute-api.us-west-2.amazonaws.com/prod"
```

Verify the secret was added:
```bash
gh secret list --repo ConnectBest/chat | grep WEBSOCKET
```

---

## Step 3: Update Local Development Environment

For local development, update your `.env.local`:

```bash
NEXT_PUBLIC_WEBSOCKET_URL=wss://your-api-id.execute-api.us-west-2.amazonaws.com/prod
```

---

## Step 4: Deploy Frontend with WebSocket Support

The GitHub workflow will automatically deploy the frontend with WebSocket support:

```bash
git add .
git commit -m "feat: add AWS serverless WebSocket infrastructure"
git push origin main
```

The workflow will:
1. Build the Next.js app with WebSocket client
2. Push to ECR
3. Deploy to Lightsail with `NEXT_PUBLIC_WEBSOCKET_URL` environment variable

---

## Verification

### 1. Check CloudFormation Stack

```bash
aws cloudformation describe-stacks \
  --stack-name connectbest-websocket \
  --region us-west-2 \
  --query 'Stacks[0].StackStatus'
```

Expected: `CREATE_COMPLETE` or `UPDATE_COMPLETE`

### 2. Check API Gateway

```bash
aws apigatewayv2 get-apis \
  --region us-west-2 \
  --query 'Items[?Name==`connectbest-websocket-websocket`]'
```

### 3. Check DynamoDB Table

```bash
aws dynamodb describe-table \
  --table-name connectbest-websocket-connections \
  --region us-west-2 \
  --query 'Table.TableStatus'
```

Expected: `ACTIVE`

### 4. Test WebSocket Connection

Use wscat to test the connection:

```bash
# Install wscat
npm install -g wscat

# Connect
wscat -c "wss://your-api-id.execute-api.us-west-2.amazonaws.com/prod?userId=test&channelId=general"

# Send a message
{"action":"sendMessage","channelId":"general","message":"Hello!","userId":"test","userName":"Test User"}
```

---

## Monitoring

### View Lambda Logs

```bash
# Connect function logs
sam logs -n ConnectFunction --stack-name connectbest-websocket --tail

# Message function logs
sam logs -n MessageFunction --stack-name connectbest-websocket --tail

# Disconnect function logs
sam logs -n DisconnectFunction --stack-name connectbest-websocket --tail
```

### CloudWatch Logs

All Lambda logs are in CloudWatch Logs:
- `/aws/lambda/connectbest-websocket-ConnectFunction-*`
- `/aws/lambda/connectbest-websocket-MessageFunction-*`
- `/aws/lambda/connectbest-websocket-DisconnectFunction-*`

### DynamoDB Monitoring

View active connections:

```bash
aws dynamodb scan \
  --table-name connectbest-websocket-connections \
  --region us-west-2
```

---

## Troubleshooting

### Issue: "Unable to import module"

**Cause:** Lambda dependencies not installed

**Fix:**
```bash
cd websocket-api/src/handlers
npm install
cd ../..
sam build
sam deploy
```

### Issue: "Connection failed immediately"

**Cause:** WebSocket URL incorrect or API not deployed

**Fix:**
1. Verify the URL format: `wss://` (not `ws://`)
2. Check API Gateway deployment:
   ```bash
   aws apigatewayv2 get-stages \
     --api-id YOUR_API_ID \
     --region us-west-2
   ```

### Issue: "Messages not being delivered"

**Cause:** Connection not stored in DynamoDB or Lambda permissions issue

**Fix:**
1. Check ConnectFunction logs for errors
2. Verify DynamoDB table has items:
   ```bash
   aws dynamodb scan --table-name connectbest-websocket-connections
   ```
3. Check IAM role permissions

### Issue: Frontend not connecting

**Cause:** `NEXT_PUBLIC_WEBSOCKET_URL` not set or incorrect

**Fix:**
1. Verify GitHub secret exists
2. Redeploy frontend
3. Check browser console for connection errors

---

## Updating the Infrastructure

To update Lambda functions or configuration:

```bash
cd websocket-api

# Make your changes to handler code or template.yaml

# Redeploy
sam build
sam deploy
```

No need to update GitHub secrets unless the WebSocket URL changes.

---

## Cleanup (Optional)

To remove all WebSocket infrastructure:

```bash
aws cloudformation delete-stack \
  --stack-name connectbest-websocket \
  --region us-west-2

# Wait for deletion
aws cloudformation wait stack-delete-complete \
  --stack-name connectbest-websocket \
  --region us-west-2
```

Remove the GitHub secret:
```bash
gh secret remove NEXT_PUBLIC_WEBSOCKET_URL --repo ConnectBest/chat
```

---

## Cost Optimization

For academic demonstration:

1. **DynamoDB TTL**: Already enabled (24-hour auto-cleanup of stale connections)
2. **Lambda Memory**: Set to 256MB (balance between cost and performance)
3. **Pay-per-use**: No charges when not in use
4. **Free tier eligible**: First 1M Lambda requests/month free

**Estimated monthly cost:**
- 10,000 messages/day ≈ 300K/month
- API Gateway: $0.30
- Lambda: $0.00 (free tier)
- DynamoDB: $0.00 (free tier)
- **Total: ~$0.30/month**

---

## Architecture Diagram

```
User Browser
    ↓ (WSS)
API Gateway WebSocket
    ↓
    ├─→ $connect → ConnectFunction → DynamoDB (store connection)
    ├─→ $disconnect → DisconnectFunction → DynamoDB (remove connection)
    └─→ $default → MessageFunction
                      ↓
                      ├─→ Read: DynamoDB (get channel connections)
                      └─→ Write: API Gateway (broadcast to connections)
```

---

## Next Steps

1. ✅ Deploy WebSocket infrastructure
2. ✅ Add NEXT_PUBLIC_WEBSOCKET_URL to GitHub Secrets
3. ✅ Deploy frontend with WebSocket support
4. Test real-time messaging in the chat application
5. Monitor CloudWatch logs for any issues

For questions or issues, check the logs or create an issue in the repository.
