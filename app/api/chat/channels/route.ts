import { NextResponse } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');

  try {
    console.log('[Channels API] Fetching channels, backend URL:', BACKEND_URL);

    const response = await fetch(`${BACKEND_URL}/api/chat/channels`, {
      headers: authHeader ? { 'Authorization': authHeader } : {},
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
  const authHeader = request.headers.get('authorization');

  try {
    const body = await request.json().catch(() => ({}));

    console.log('[Channels API] Creating channel, backend URL:', BACKEND_URL);

    const response = await fetch(`${BACKEND_URL}/api/chat/channels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { 'Authorization': authHeader }),
      },
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
