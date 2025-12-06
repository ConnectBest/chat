import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET() {
  try {
    console.log('[DM Conversations API] Fetching conversations, backend URL:', BACKEND_URL);

    // Get current session to verify authentication
    const session = await auth();

    if (!session?.user) {
      console.error('[DM Conversations API] No authenticated session');
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

    const response = await fetch(`${BACKEND_URL}/api/dm/conversations`, {
      headers
    });

    if (!response.ok) {
      console.error('[DM Conversations API] Fetch failed:', response.status);
      return NextResponse.json(
        { error: 'Failed to fetch conversations' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[DM Conversations API] Successfully fetched conversations');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[DM Conversations API] Error fetching conversations:', error);
    return NextResponse.json(
      { error: 'Failed to connect to messaging service' },
      { status: 500 }
    );
  }
}