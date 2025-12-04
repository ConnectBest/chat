import { NextResponse } from 'next/server';

<<<<<<< HEAD
const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  const authHeader = request.headers.get('authorization');
  
  try {
    const response = await fetch(`${BACKEND_API_URL}/chat/channels/${channelId}/messages`, {
      headers: authHeader ? { 'Authorization': authHeader } : {},
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to connect to chat service' },
      { status: 500 }
    );
  }
=======
// Static code Backend team please change it to dynamic
export async function GET(_req: Request, { params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params;
  return NextResponse.json({ messages: listMessages(channelId) }, { status: 200 });
>>>>>>> 399e8d1b7b8b74bbff8cb0637d760c3feae65df8
}
