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
    console.log('[Message API] Fetching message:', messageId);

    // Get authenticated headers with JWT token
    const authData = await getUserHeaders(request);

    if (!authData) {
      console.error('[Message API] No authenticated session');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/chat/messages/${messageId}`, {
      headers: authData.headers
    });

    if (!response.ok) {
      console.error('[Message API] Fetch failed:', response.status);
      return NextResponse.json(
        { error: 'Failed to fetch message' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[Message API] Successfully fetched message');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Message API] Error fetching message:', error);
    return NextResponse.json(
      { error: 'Failed to connect to chat service' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params;
    const body = await request.json().catch(() => ({}));
    console.log('[Message API] Updating message:', messageId);

    // Get current session to verify authentication
    const session = await auth(request as any, {} as any);

    if (!session?.user) {
      console.error('[Message API] No authenticated session');
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

    const response = await fetch(`${BACKEND_URL}/api/chat/messages/${messageId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('[Message API] Update failed:', response.status);
      return NextResponse.json(
        { error: 'Failed to update message' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[Message API] Successfully updated message');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Message API] Error updating message:', error);
    return NextResponse.json(
      { error: 'Failed to update message' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params;
    console.log('[Message API] Deleting message:', messageId);

    // Get current session to verify authentication
    const session = await auth(request as any, {} as any);

    if (!session?.user) {
      console.error('[Message API] No authenticated session');
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

    const response = await fetch(`${BACKEND_URL}/api/chat/messages/${messageId}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      console.error('[Message API] Delete failed:', response.status);
      return NextResponse.json(
        { error: 'Failed to delete message' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[Message API] Successfully deleted message');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Message API] Error deleting message:', error);
    return NextResponse.json(
      { error: 'Failed to delete message' },
      { status: 500 }
    );
  }
}
