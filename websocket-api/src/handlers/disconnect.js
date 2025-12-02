const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;

  try {
    await ddb.send(new DeleteCommand({
      TableName: process.env.CONNECTIONS_TABLE,
      Key: { connectionId }
    }));

    console.log(`Connection removed: ${connectionId}`);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Disconnected successfully' })
    };
  } catch (error) {
    console.error('Error removing connection:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to disconnect', error: error.message })
    };
  }
};
