import { ChannelView } from '@/components/chat/ChannelView';

export default async function DMPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return <ChannelView channelId={`dm-${userId}`} isDM={true} dmUserId={userId} />;
}
