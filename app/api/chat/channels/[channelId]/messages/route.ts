import { NextResponse } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  const authHeader = request.headers.get('authorization');

  try {
    console.log(`[Messages API] Fetching messages for channel ${channelId}, backend URL:`, BACKEND_URL);

    const response = await fetch(`${BACKEND_URL}/api/chat/channels/${channelId}/messages`, {
      headers: authHeader ? { 'Authorization': authHeader } : {},
    });

    if (!response.ok) {
      console.error('[Messages API] Fetch failed:', response.status);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`[Messages API] Successfully fetched messages for channel ${channelId}`);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Messages API] Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to connect to chat service' },
      { status: 500 }
    );
  }
}
