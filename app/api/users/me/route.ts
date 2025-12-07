import { NextResponse } from 'next/server';
import { getUserHeaders } from '@/lib/apiUtils';
import type { NextRequest } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(request: NextRequest) {
  try {
    console.log('[Users/Me API] Fetching current user, backend URL:', BACKEND_URL);

    // Get authenticated user headers with JWT token
    const authData = await getUserHeaders(request);

    if (!authData) {
      console.error('[Users/Me API] No authenticated session');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log('[Users/Me API] Session check:', {
      hasSession: true,
      userId: (authData.session.user as any).id,
      hasAuthHeaders: !!authData.headers['Authorization']
    });

    const response = await fetch(`${BACKEND_URL}/api/users/me`, {
      headers: authData.headers
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Users/Me API] Fetch failed:', data);
      return NextResponse.json(
        { error: data.error || 'Failed to fetch user' },
        { status: response.status }
      );
    }

    console.log('[Users/Me API] Successfully fetched user');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Users/Me API] Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to connect to user service' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    console.log('[Users/Me API] Updating current user, backend URL:', BACKEND_URL);

    // Get authenticated user headers with JWT token
    const authData = await getUserHeaders(request);

    if (!authData) {
      console.error('[Users/Me API] No authenticated session');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/users/me`, {
      method: 'PUT',
      headers: authData.headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Users/Me API] Update failed:', data);
      return NextResponse.json(
        { error: data.error || 'Failed to update user' },
        { status: response.status }
      );
    }

    console.log('[Users/Me API] Successfully updated user');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Users/Me API] Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to connect to user service' },
      { status: 500 }
    );
  }
}