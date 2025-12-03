import OpenAI from "openai";
import fs from "fs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function transcribeAudio(localFilePath: string) {
  // 可用 fs.createReadStream() 上傳
  const response = await openai.audio.transcriptions.create({
    model: "gpt-4o-audio-transcribe",
    file: fs.createReadStream(localFilePath),
  });

  return response.text;
}