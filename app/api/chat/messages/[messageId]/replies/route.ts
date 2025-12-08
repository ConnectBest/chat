import { NextResponse } from 'next/server';
import { getUserHeaders } from '@/lib/apiUtils';
import type { NextRequest } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params;
    console.log('[Thread Replies API] Fetching replies for message:', messageId);

    // Get authenticated headers with JWT token
    const authData = await getUserHeaders(request);

    if (!authData) {
      console.error('[Thread Replies API] No authenticated session');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/chat/messages/${messageId}/replies`, {
      headers: authData.headers
    });

    if (!response.ok) {
      console.error('[Thread Replies API] Fetch failed:', response.status);
      return NextResponse.json(
        { error: 'Failed to fetch thread replies' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[Thread Replies API] Successfully fetched thread replies');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Thread Replies API] Error fetching thread replies:', error);
    return NextResponse.json(
      { error: 'Failed to connect to chat service' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params;
    const body = await request.json().catch(() => ({}));
    console.log('[Thread Replies API] Posting reply to message:', messageId);

    // Get authenticated headers with JWT token
    const authData = await getUserHeaders(request);

    if (!authData) {
      console.error('[Thread Replies API] No authenticated session');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/chat/messages/${messageId}/replies`, {
      method: 'POST',
      headers: authData.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('[Thread Replies API] Post failed:', response.status);
      return NextResponse.json(
        { error: 'Failed to post thread reply' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[Thread Replies API] Successfully posted thread reply');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Thread Replies API] Error posting thread reply:', error);
    return NextResponse.json(
      { error: 'Failed to post thread reply' },
      { status: 500 }
    );
  }
}
