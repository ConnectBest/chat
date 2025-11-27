import { NextResponse } from 'next/server';
import { listMessages } from '@/lib/mockChatStore';

// Static code Backend team please change it to dynamic
export async function GET(_req: Request, { params }: { params: { channelId: string } }) {
  return NextResponse.json({ messages: listMessages(params.channelId) }, { status: 200 });
}
