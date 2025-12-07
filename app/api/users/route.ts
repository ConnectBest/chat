import { NextResponse } from 'next/server';
import { getUserHeaders } from '@/lib/apiUtils';
import type { NextRequest } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(request: NextRequest) {
  try {
    console.log('[Users API] Fetching users, backend URL:', BACKEND_URL);

    // Get current session and user headers
    const authData = await getUserHeaders(request);

    if (!authData) {
      console.error('[Users API] No authenticated session');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { headers } = authData;

    console.log('[Users API] Sending headers to backend:', {
      userId: headers['X-User-ID'],
      email: headers['X-User-Email'],
      role: headers['X-User-Role']
    });

    const response = await fetch(`${BACKEND_URL}/api/users`, {
      headers
    });

    if (!response.ok) {
      console.error('[Users API] Fetch failed:', response.status);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[Users API] Successfully fetched users');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Users API] Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to connect to user service' },
      { status: 500 }
    );
  }
}
