const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const queryParams = event.queryStringParameters || {};

  // Extract user info from query params (userId, channelId)
  const userId = queryParams.userId || 'anonymous';
  const channelId = queryParams.channelId || 'general';

  // Store connection in DynamoDB
  const ttl = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours

  try {
    await ddb.send(new PutCommand({
      TableName: process.env.CONNECTIONS_TABLE,
      Item: {
        connectionId,
        userId,
        channelId,
        connectedAt: new Date().toISOString(),
        ttl
      }
    }));

    console.log(`Connection stored: ${connectionId} for user ${userId} in channel ${channelId}`);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Connected successfully' })
    };
  } catch (error) {
    console.error('Error storing connection:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to connect', error: error.message })
    };
  }
};
