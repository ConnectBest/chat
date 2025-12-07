import { NextResponse } from 'next/server';
import { getUserHeaders } from '@/lib/apiUtils';
import type { NextRequest } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params;
    console.log('[DM Read API] Marking DM channel as read:', channelId);

    // Get authenticated user headers with JWT token
    const authData = await getUserHeaders(request);

    if (!authData) {
      console.error('[DM Read API] No authenticated session');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/dm/channels/${channelId}/read`, {
      method: 'POST',
      headers: authData.headers,
    });

    if (!response.ok) {
      console.error('[DM Read API] Post failed:', response.status);
      return NextResponse.json(
        { success: false },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[DM Read API] Successfully marked DM channel as read');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[DM Read API] Error marking DM channel as read:', error);
    return NextResponse.json(
      { success: false },
      { status: 500 }
    );
  }
}
