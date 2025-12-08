import { NextResponse } from 'next/server';
import { getUserHeaders } from '@/lib/apiUtils';
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

    // Get authenticated headers with JWT token
    const authData = await getUserHeaders(request);

    if (!authData) {
      console.error('[Bookmark API] No authenticated session');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    const response = await fetch(`${BACKEND_URL}/api/chat/messages/${messageId}/bookmark`, {
      method: 'POST',
      headers: authData.headers,
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
