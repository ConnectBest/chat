const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const domain = event.requestContext.domainName;
  const stage = event.requestContext.stage;

  // Create API Gateway Management API client
  const apigwManagementApi = new ApiGatewayManagementApiClient({
    endpoint: `https://${domain}/${stage}`
  });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { action, channelId, message, userId, userName } = body;

  console.log('Received message:', { action, channelId, message, userId, userName });

  try {
    // Get sender's connection info
    const senderConnection = await ddb.send(new GetCommand({
      TableName: process.env.CONNECTIONS_TABLE,
      Key: { connectionId }
    }));

    const senderChannelId = senderConnection.Item?.channelId || channelId || 'general';

    // Query all connections in the same channel
    const connections = await ddb.send(new QueryCommand({
      TableName: process.env.CONNECTIONS_TABLE,
      IndexName: 'channelId-index',
      KeyConditionExpression: 'channelId = :channelId',
      ExpressionAttributeValues: {
        ':channelId': senderChannelId
      }
    }));

    console.log(`Found ${connections.Items?.length || 0} connections in channel ${senderChannelId}`);

    // Prepare message to broadcast
    const messageData = {
      type: 'message',
      channelId: senderChannelId,
      message,
      userId: userId || senderConnection.Item?.userId,
      userName: userName || 'Anonymous',
      timestamp: new Date().toISOString()
    };

    // Broadcast to all connections in the channel
    const postPromises = (connections.Items || []).map(async (connection) => {
      try {
        await apigwManagementApi.send(new PostToConnectionCommand({
          ConnectionId: connection.connectionId,
          Data: JSON.stringify(messageData)
        }));
        console.log(`Message sent to connection: ${connection.connectionId}`);
      } catch (error) {
        console.error(`Failed to send to ${connection.connectionId}:`, error.message);
        // If connection is stale, we could delete it here
        if (error.statusCode === 410) {
          console.log(`Stale connection detected: ${connection.connectionId}`);
        }
      }
    });

    await Promise.all(postPromises);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Message broadcast successfully',
        recipients: connections.Items?.length || 0
      })
    };
  } catch (error) {
    console.error('Error processing message:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to process message', details: error.message })
    };
  }
};
