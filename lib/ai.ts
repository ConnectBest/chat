import OpenAI from "openai";
import { ObjectId } from "mongodb";
import { getDb } from "./database";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * 最通用的 AI prompt 處理器
 */
export async function processAIPrompt(options: {
  userId: string;
  channelId?: string;
  prompt: string;
  contextMessages?: any[];
}) {
  const { userId, channelId, prompt, contextMessages } = options;

  // 👇 關鍵修正：把 messages 明確標成 OpenAI.ChatCompletionMessageParam[]
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "You are a helpful assistant for a Slack-like chat application. Help users write, summarize, improve or translate messages.",
    },
  ];

  if (contextMessages && contextMessages.length > 0) {
    messages.push({
      role: "system",
      content: `Conversation context: ${JSON.stringify(contextMessages)}`,
    });
  }

  messages.push({
    role: "user",
    content: prompt,
  });

  const start = Date.now();

  const result = await openai.chat.completions.create({
    model: "gpt-4o", // 建議：更快更便宜
    messages,
    temperature: 0.7,
    max_tokens: 300,
  });

  const text = result.choices[0]?.message?.content ?? "";
  const tokensUsed = result.usage?.total_tokens ?? 0;
  const processingTime = Date.now() - start;

  // 將 AI 使用記錄存進 Mongo（aiPrompts collection）
  const db = await getDb();

  await db.collection("aiPrompts").insertOne({
    userId: new ObjectId(userId),
    channelId: channelId ? new ObjectId(channelId) : null,
    prompt,
    response: text,
    model: "gpt-4o",
    tokensUsed,
    processingTime,
    context: contextMessages || [],
    createdAt: new Date(),
  });

  return {
    response: text,
    tokensUsed,
  };
}