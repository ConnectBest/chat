import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
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

    // Get current session to verify authentication (NextAuth v5 API route style)
    const session = await auth(request as any, {} as any);

    console.log('[Send Message API] Session check:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user ? (session.user as any).id : null,
      channelId
    });

    if (!session?.user) {
      console.error('[Send Message API] No authenticated session');
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

    console.log('[Send Message API] Sending headers to backend:', {
      userId: headers['X-User-ID'],
      email: headers['X-User-Email'],
      role: headers['X-User-Role'],
      channelId
    });

    const response = await fetch(`${BACKEND_URL}/api/chat/channels/${channelId}/messages/send`, {
      method: 'POST',
      headers,
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
