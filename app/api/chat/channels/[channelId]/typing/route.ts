import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import type { NextRequest } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params;
    console.log('[Typing API] Fetching typing users for channel:', channelId);

    // Get current session to verify authentication
    const session = await auth(request as any, {} as any);

    if (!session?.user) {
      console.error('[Typing API] No authenticated session');
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

    const response = await fetch(`${BACKEND_URL}/api/chat/channels/${channelId}/typing`, {
      headers
    });

    if (!response.ok) {
      console.error('[Typing API] Fetch failed:', response.status);
      // Return empty typing users on error (typing is non-critical)
      return NextResponse.json({ typing_users: [] }, { status: 200 });
    }

    const data = await response.json();
    console.log('[Typing API] Successfully fetched typing users');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Typing API] Error fetching typing users:', error);
    // Return empty typing users on error (typing is non-critical)
    return NextResponse.json({ typing_users: [] }, { status: 200 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params;
    const body = await request.json().catch(() => ({}));
    console.log('[Typing API] Setting typing status for channel:', channelId);

    // Get current session to verify authentication
    const session = await auth(request as any, {} as any);

    if (!session?.user) {
      console.error('[Typing API] No authenticated session');
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

    const response = await fetch(`${BACKEND_URL}/api/chat/channels/${channelId}/typing`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('[Typing API] Post failed:', response.status);
      return NextResponse.json(
        { success: false },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[Typing API] Successfully set typing status');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Typing API] Error setting typing status:', error);
    return NextResponse.json(
      { success: false },
      { status: 500 }
    );
  }
}
