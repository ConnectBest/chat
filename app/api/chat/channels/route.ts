import { NextResponse } from 'next/server';
import { getUserHeaders } from '@/lib/apiUtils';
import type { NextRequest } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(request: NextRequest) {
  try {
    console.log('[Channels API] Fetching channels, backend URL:', BACKEND_URL);

    // Get authenticated headers with JWT token
    const authData = await getUserHeaders(request);

    if (!authData) {
      console.error('[Channels API] No authenticated session');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/chat/channels`, {
      headers: authData.headers
    });

    if (!response.ok) {
      console.error('[Channels API] Fetch failed:', response.status);
      return NextResponse.json(
        { error: 'Failed to fetch channels' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[Channels API] Successfully fetched channels');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Channels API] Error fetching channels:', error);
    return NextResponse.json(
      { error: 'Failed to connect to chat service' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    console.log('[Channels API] Creating channel, backend URL:', BACKEND_URL);

    // Get authenticated headers with JWT token
    const authData = await getUserHeaders(request as NextRequest);

    if (!authData) {
      console.error('[Channels API] No authenticated session');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/chat/channels`, {
      method: 'POST',
      headers: authData.headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Channels API] Create failed:', data);
      return NextResponse.json(
        { error: data.error || 'Failed to create channel' },
        { status: response.status }
      );
    }

    console.log('[Channels API] Successfully created channel');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Channels API] Error creating channel:', error);
    return NextResponse.json(
      { error: 'Failed to connect to chat service' },
      { status: 500 }
    );
  }
}