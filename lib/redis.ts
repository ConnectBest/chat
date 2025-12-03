import { createClient, RedisClientType } from "redis";

const rawUrl = process.env.REDIS_URL;

if (!rawUrl) {
  throw new Error("REDIS_URL is not set in environment variables");
}

const url: string = rawUrl;

const client: RedisClientType = createClient({ url });

client.on("error", (err) => {
  console.error("Redis Client Error", err);
});

let connectPromise: Promise<RedisClientType> | null = null;

export async function getRedis(): Promise<RedisClientType> {
  if (!connectPromise) {
    connectPromise = client.connect();
  }

  await connectPromise;

  return client;
}