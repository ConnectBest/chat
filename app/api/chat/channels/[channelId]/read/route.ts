import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import type { NextRequest } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function POST(
  request: NextRequest,
  { params }: { params: { channelId: string } }
) {
  try {
    const { channelId } = params;
    console.log('[Channel Read API] Marking channel as read:', channelId);

    // Get current session to verify authentication
    const session = await auth(request as any, {} as any);

    if (!session?.user) {
      console.error('[Channel Read API] No authenticated session');
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

    const response = await fetch(`${BACKEND_URL}/api/chat/channels/${channelId}/read`, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      console.error('[Channel Read API] Post failed:', response.status);
      return NextResponse.json(
        { success: false },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[Channel Read API] Successfully marked channel as read');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Channel Read API] Error marking channel as read:', error);
    return NextResponse.json(
      { success: false },
      { status: 500 }
    );
  }
}
