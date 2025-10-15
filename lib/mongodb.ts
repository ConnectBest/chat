import { MongoClient } from 'mongodb';

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

export async function getMongoClient(): Promise<MongoClient> {
  if (client) {
    return client;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  if (!clientPromise) {
    clientPromise = MongoClient.connect(process.env.MONGODB_URI);
  }

  client = await clientPromise;
  return client;
}

export async function checkMongoConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    const client = await getMongoClient();
    await client.db().admin().ping();
    return { connected: true };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
