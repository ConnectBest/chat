import { NextResponse } from 'next/server';
import { getUserHeaders } from '@/lib/apiUtils';
import type { NextRequest } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(request: NextRequest) {
  try {
    console.log('[DM Conversations API] Fetching conversations, backend URL:', BACKEND_URL);

    // Get authenticated user headers with JWT token
    const authData = await getUserHeaders(request);

    if (!authData) {
      console.error('[DM Conversations API] No authenticated session');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log('[DM Conversations API] Session check:', {
      hasSession: true,
      userId: authData.userId,
      hasAuthHeaders: !!authData.headers['Authorization']
    });

    const response = await fetch(`${BACKEND_URL}/api/dm/conversations`, {
      headers: authData.headers
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