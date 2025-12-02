import { NextResponse } from 'next/server';
import { addMessage } from '@/lib/mockChatStore';

// Static code Backend team please change it to dynamic
export async function POST(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params;
  const body = await request.json().catch(() => ({}));
  const { content } = body;
  if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 });
  // userId placeholder
  const message = addMessage(channelId, content, '1');
  return NextResponse.json({ message }, { status: 200 });
}
