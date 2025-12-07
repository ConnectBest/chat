import { NextResponse } from 'next/server';
import { getUserHeaders } from '@/lib/apiUtils';
import type { NextRequest } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;

  try {
    const body = await request.json().catch(() => ({}));

    console.log(`[Send Message API] Sending message to channel ${channelId}, backend URL:`, BACKEND_URL);

    // Get authenticated headers with JWT token
    const authData = await getUserHeaders(request);

    if (!authData) {
      console.error('[Send Message API] No authenticated session');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/chat/channels/${channelId}/messages/send`, {
      method: 'POST',
      headers: authData.headers,
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
