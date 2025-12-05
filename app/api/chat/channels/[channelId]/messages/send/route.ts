import { NextResponse } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  const authHeader = request.headers.get('authorization');

  try {
    const body = await request.json().catch(() => ({}));

    console.log(`[Send Message API] Sending message to channel ${channelId}, backend URL:`, BACKEND_URL);

    const response = await fetch(`${BACKEND_URL}/api/chat/channels/${channelId}/messages/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { 'Authorization': authHeader }),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Send Message API] Send failed:', data);
      return NextResponse.json(
        { error: data.error || 'Failed to send message' },
        { status: response.status }
      );
    }

    console.log(`[Send Message API] Successfully sent message to channel ${channelId}`);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Send Message API] Error sending message:', error);
    return NextResponse.json(
      { error: 'Failed to connect to chat service' },
      { status: 500 }
    );
  }
}
