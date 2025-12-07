import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import type { NextRequest } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(
  request: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    const { messageId } = params;
    console.log('[Thread Replies API] Fetching replies for message:', messageId);

    // Get current session to verify authentication
    const session = await auth(request as any, {} as any);

    if (!session?.user) {
      console.error('[Thread Replies API] No authenticated session');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Create headers with user info for Flask backend
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-User-ID': (session.user as any).id,
      'X-User-Email': session.user.email || '',
      'X-User-Role': (session.user as any).role || 'user'
    };

    const response = await fetch(`${BACKEND_URL}/api/chat/messages/${messageId}/replies`, {
      headers
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
  { params }: { params: { messageId: string } }
) {
  try {
    const { messageId } = params;
    const body = await request.json().catch(() => ({}));
    console.log('[Thread Replies API] Posting reply to message:', messageId);

    // Get current session to verify authentication
    const session = await auth(request as any, {} as any);

    if (!session?.user) {
      console.error('[Thread Replies API] No authenticated session');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Create headers with user info for Flask backend
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-User-ID': (session.user as any).id,
      'X-User-Email': session.user.email || '',
      'X-User-Role': (session.user as any).role || 'user'
    };

    const response = await fetch(`${BACKEND_URL}/api/chat/messages/${messageId}/replies`, {
      method: 'POST',
      headers,
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
