import OpenAI from "openai";
import { getDb } from "./database";
import { ObjectId } from "mongodb";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function embedMessage(messageId: string, content: string) {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: content,
  });

  const vector = res.data[0].embedding;

  const db = await getDb();
  await db.collection("messages").updateOne(
    { _id: new ObjectId(messageId) },
    { $set: { embedding: vector } }
  );
}