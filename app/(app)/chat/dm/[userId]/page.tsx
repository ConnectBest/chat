import { ChannelView } from "@/components/chat/ChannelView";
import { auth } from "@/lib/auth";

export default async function DMPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  // ✅ Next.js 15 要先 await params
  const { userId } = await params;

  const session = await auth();

  if (!session?.user?.id) {
    // 這裡你可以改成 redirect 到登入頁
    throw new Error("Unauthorized");
  }

  const currentUserId = session.user.id as string;
  const dmUserId = userId;

  // ✅ 關鍵修正：用「兩個 userId 排序後組成」共同的 DM channelId
  // 這樣 test / Sunny 不管誰登入，都會拿到同一個 channelId
  const dmChannelId = `dm-${[currentUserId, dmUserId].sort().join("-")}`;

  return (
    <ChannelView
      channelId={dmChannelId}
      isDM={true}
      dmUserId={dmUserId}
      currentUserId={currentUserId} // ✅ 告訴 ChannelView 我是誰
    />
  );
}