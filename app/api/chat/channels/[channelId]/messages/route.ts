import { NextResponse } from 'next/server';
import { listMessages } from '@/lib/mockChatStore';

// Static code Backend team please change it to dynamic
export async function GET(_req: Request, { params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params;
  return NextResponse.json({ messages: listMessages(channelId) }, { status: 200 });
}
