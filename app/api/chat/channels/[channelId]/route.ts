import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import type { NextRequest } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(
  request: NextRequest,
  { params }: { params: { channelId: string } }
) {
  try {
    const { channelId } = params;
    console.log('[Channel Details API] Fetching channel details:', channelId);

    // Get current session to verify authentication
    const session = await auth(request as any, {} as any);

    if (!session?.user) {
      console.error('[Channel Details API] No authenticated session');
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

    const response = await fetch(`${BACKEND_URL}/api/chat/channels/${channelId}`, {
      headers
    });

    if (!response.ok) {
      console.error('[Channel Details API] Fetch failed:', response.status);
      return NextResponse.json(
        { error: 'Failed to fetch channel details' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[Channel Details API] Successfully fetched channel details');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Channel Details API] Error fetching channel details:', error);
    return NextResponse.json(
      { error: 'Failed to connect to chat service' },
      { status: 500 }
    );
  }
}
