import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ChatRoom from "./ChatRoom";
import { channelsCollection } from "@/lib/database";
import { ObjectId } from "mongodb";

interface PageProps {
  // Next 15 sync-dynamic-apis：params 是 Promise
  params: Promise<{ channelId: string }>;
}

export default async function ChannelPage({ params }: PageProps) {
  // 1) 先拿 session
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // 2) await params 才能拿到 channelId
  const { channelId } = await params;
  const currentUserId = session.user.id as string;

  // 3) 先用 URL 裡的字串當 fallback 名稱
  let channelName = decodeURIComponent(channelId);

  // 4) 如果 channelId 是合法 ObjectId，再去 Mongo 找真正名稱
  if (ObjectId.isValid(channelId)) {
    try {
      const col = await channelsCollection();
      const doc = await col.findOne({ _id: new ObjectId(channelId) });
      if (doc?.name) {
        channelName = doc.name;
      }
    } catch (err) {
      console.error("Failed to load channel doc for title:", err);
    }
  }

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-50">
      <ChatRoom
        channelId={channelId}
        currentUserId={currentUserId}
        channelName={channelName}
      />
    </div>
  );
}