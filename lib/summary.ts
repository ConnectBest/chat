import { getDb } from "./database";
import OpenAI from "openai";
import { ObjectId } from "mongodb";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function summarizeChannel(channelId: string, start: Date, end: Date) {
  const db = await getDb();

  const messages = await db
    .collection("messages")
    .find({
      channelId: new ObjectId(channelId),
      createdAt: { $gte: start, $lte: end },
      isDeleted: false,
    })
    .sort({ createdAt: 1 })
    .toArray();

  const text = messages
    .map((m) => `${m.userId}: ${m.content}`)
    .join("\n");

  const result = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "Summarize key decisions, actions, and important announcements.",
      },
      {
        role: "user",
        content: text,
      },
    ],
  });

  return result.choices[0].message.content;
}