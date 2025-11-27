import React from 'react';
import { ChannelView } from '@/components/chat/ChannelView';

export default function ChannelPage({ params }: { params: { channelId: string } }) {
  return <ChannelView channelId={params.channelId} />;
}
