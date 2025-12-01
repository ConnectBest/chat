import { NextResponse } from 'next/server';
import { listChannels, addChannel } from '@/lib/mockChatStore';

// Static code Backend team please change it to dynamic
export async function GET() {
  return NextResponse.json({ channels: listChannels() }, { status: 200 });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { name } = body;
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const channel = addChannel(name);
  return NextResponse.json({ channel }, { status: 200 });
}
