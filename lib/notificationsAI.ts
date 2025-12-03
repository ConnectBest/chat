export function scoreNotification({
  hasMention,
  isDM,
  senderIsAdmin,
  messageLength,
  channelActivityLevel,
}: {
  hasMention: boolean;
  isDM: boolean;
  senderIsAdmin: boolean;
  messageLength: number;
  channelActivityLevel: number;
}) {
  let score = 0;

  if (hasMention) score += 0.5;
  if (isDM) score += 0.4;
  if (senderIsAdmin) score += 0.2;

  score += Math.min(messageLength / 200, 0.3);
  score += Math.min(channelActivityLevel / 50, 0.3);

  return Math.min(score, 1);
}

export function shouldSendPush(score: number): boolean {
  return score > 0.7;
}