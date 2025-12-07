import { NextResponse } from 'next/server';
import { getUserHeaders } from '@/lib/apiUtils';
import type { NextRequest } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(request: NextRequest) {
  try {
    console.log('[Me API] Fetching user info, backend URL:', BACKEND_URL);

    // Get authenticated headers with JWT token
    const authData = await getUserHeaders(request);

    if (!authData) {
      console.error('[Me API] No authenticated session');
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
      headers: authData.headers
    });

    if (!response.ok) {
      console.error('[Me API] Fetch failed:', response.status);
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const data = await response.json();
    console.log('[Me API] Successfully fetched user info');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Me API] Error fetching user:', error);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
