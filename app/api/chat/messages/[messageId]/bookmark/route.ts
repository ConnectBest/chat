import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import type { NextRequest } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params;
    console.log('[Bookmark API] Toggling bookmark for message:', messageId);

    // Get current session to verify authentication
    const session = await auth(request as any, {} as any);

    if (!session?.user) {
      console.error('[Bookmark API] No authenticated session');
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

    const response = await fetch(`${BACKEND_URL}/api/chat/messages/${messageId}/bookmark`, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      console.error('[Bookmark API] Post failed:', response.status);
      return NextResponse.json(
        { error: 'Failed to toggle bookmark' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[Bookmark API] Successfully toggled bookmark');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Bookmark API] Error toggling bookmark:', error);
    return NextResponse.json(
      { error: 'Failed to toggle bookmark' },
      { status: 500 }
    );
  }
}
