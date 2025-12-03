import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// 可以順便幫這個函式定一個回傳型別
export type ModerationAction = "allow" | "flag" | "block";

export interface ModerationResult {
  allowed: boolean;
  action: ModerationAction;
  categories: (keyof OpenAI.Moderations.Moderation["categories"])[];
}

/**
 * 回傳：
 * { allowed: boolean, action: "allow" | "flag" | "block", categories: [...] }
 */
export async function moderateMessage(content: string): Promise<ModerationResult> {
  const res = await openai.moderations.create({
    model: "omni-moderation-latest",
    input: content,
  });

  const result = res.results[0];

  if (!result.flagged) {
    return { allowed: true, action: "allow", categories: [] };
  }

  // 👇 關鍵修正：把 key 陣列轉成合法的 key 型別
  const categoryKeys = Object.keys(
    result.categories
  ) as (keyof typeof result.categories)[];

  const categories = categoryKeys.filter((cat) => result.categories[cat]);

  const highSeverity =
    (result.category_scores.violence ?? 0) > 0.8 ||
    (result.category_scores.hate ?? 0) > 0.8;

  return {
    allowed: !highSeverity,
    action: highSeverity ? "block" : "flag",
    categories,
  };
}