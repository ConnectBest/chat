import { NextResponse } from 'next/server';
import { getUserHeaders } from '@/lib/apiUtils';
import type { NextRequest } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string; messageId: string }> }
) {
  try {
    const { channelId, messageId } = await params;
    const body = await request.json().catch(() => ({}));

    // Get authenticated headers with JWT token
    const authData = await getUserHeaders(request);

    if (!authData) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const response = await fetch(
      `${BACKEND_URL}/api/chat/channels/${channelId}/messages/${messageId}/reactions`,
      {
        method: 'POST',
        headers: authData.headers,
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to add reaction' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to add reaction' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string; messageId: string }> }
) {
  try {
    const { channelId, messageId } = await params;

    // Get authenticated headers with JWT token
    const authData = await getUserHeaders(request);

    if (!authData) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const response = await fetch(
      `${BACKEND_URL}/api/chat/channels/${channelId}/messages/${messageId}/reactions`,
      {
        method: 'DELETE',
        headers: authData.headers,
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to remove reaction' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to remove reaction' },
      { status: 500 }
    );
  }
}
