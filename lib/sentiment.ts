import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function analyzeSentiment(text: string) {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "Classify sentiment as positive, neutral, or negative.",
      },
      {
        role: "user",
        content: text,
      },
    ],
  });

  return res.choices[0].message.content?.toLowerCase();
}