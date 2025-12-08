import { NextResponse } from 'next/server';
import { getUserHeaders } from '@/lib/apiUtils';
import type { NextRequest } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params;

    // Get authenticated headers with JWT token
    const authData = await getUserHeaders(request);

    if (!authData) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/chat/channels/${channelId}/typing`, {
      headers: authData.headers
    });

    if (!response.ok) {
      // Return empty typing users on error (typing is non-critical)
      return NextResponse.json({ typing_users: [] }, { status: 200 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
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

    // Get authenticated headers with JWT token
    const authData = await getUserHeaders(request);

    if (!authData) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/chat/channels/${channelId}/typing`, {
      method: 'POST',
      headers: authData.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { success: false },
      { status: 500 }
    );
  }
}
