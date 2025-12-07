import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import type { NextRequest } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function POST(
  request: NextRequest,
  { params }: { params: { channelId: string; messageId: string } }
) {
  try {
    const { channelId, messageId } = params;
    const body = await request.json().catch(() => ({}));
    console.log('[Reactions API] Adding reaction to message:', messageId);

    // Get current session to verify authentication
    const session = await auth(request as any, {} as any);

    if (!session?.user) {
      console.error('[Reactions API] No authenticated session');
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

    const response = await fetch(
      `${BACKEND_URL}/api/chat/channels/${channelId}/messages/${messageId}/reactions`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      console.error('[Reactions API] Post failed:', response.status);
      return NextResponse.json(
        { error: 'Failed to add reaction' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[Reactions API] Successfully added reaction');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Reactions API] Error adding reaction:', error);
    return NextResponse.json(
      { error: 'Failed to add reaction' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { channelId: string; messageId: string } }
) {
  try {
    const { channelId, messageId } = params;
    console.log('[Reactions API] Removing reaction from message:', messageId);

    // Get current session to verify authentication
    const session = await auth(request as any, {} as any);

    if (!session?.user) {
      console.error('[Reactions API] No authenticated session');
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

    const response = await fetch(
      `${BACKEND_URL}/api/chat/channels/${channelId}/messages/${messageId}/reactions`,
      {
        method: 'DELETE',
        headers,
      }
    );

    if (!response.ok) {
      console.error('[Reactions API] Delete failed:', response.status);
      return NextResponse.json(
        { error: 'Failed to remove reaction' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[Reactions API] Successfully removed reaction');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Reactions API] Error removing reaction:', error);
    return NextResponse.json(
      { error: 'Failed to remove reaction' },
      { status: 500 }
    );
  }
}
