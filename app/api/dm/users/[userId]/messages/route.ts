import { NextResponse } from 'next/server';
import { getUserHeaders } from '@/lib/apiUtils';
import type { NextRequest } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    console.log('[DM Messages API] Fetching DM messages with user:', userId);

    // Get authenticated user headers with JWT token
    const authData = await getUserHeaders(request);

    if (!authData) {
      console.error('[DM Messages API] No authenticated session');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/dm/users/${userId}/messages`, {
      headers: authData.headers
    });

    if (!response.ok) {
      console.error('[DM Messages API] Fetch failed:', response.status);
      return NextResponse.json(
        { error: 'Failed to fetch DM messages' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[DM Messages API] Successfully fetched DM messages');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[DM Messages API] Error fetching DM messages:', error);
    return NextResponse.json(
      { error: 'Failed to connect to DM service' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const body = await request.json().catch(() => ({}));
    console.log('[DM Messages API] Sending DM message to user:', userId);

    // Get authenticated user headers with JWT token
    const authData = await getUserHeaders(request);

    if (!authData) {
      console.error('[DM Messages API] No authenticated session');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/dm/users/${userId}/messages`, {
      method: 'POST',
      headers: authData.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('[DM Messages API] Post failed:', response.status);
      const errorData = await response.json().catch(() => ({ error: 'Failed to send DM message' }));
      return NextResponse.json(
        errorData,
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[DM Messages API] Successfully sent DM message');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[DM Messages API] Error sending DM message:', error);
    return NextResponse.json(
      { error: 'Failed to connect to DM service' },
      { status: 500 }
    );
  }
}
