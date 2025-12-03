import { NextRequest, NextResponse } from "next/server";
import { processAIPrompt } from "@/lib/ai";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const { userId, channelId, prompt, contextMessages } = body;

  const result = await processAIPrompt({
    userId,
    channelId,
    prompt,
    contextMessages,
  });

  return NextResponse.json(result);
}