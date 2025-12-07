import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import type { NextRequest } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(request: NextRequest) {
  try {
    console.log('[Users/Me API] Fetching current user, backend URL:', BACKEND_URL);

    // Get current session to verify authentication (NextAuth v5 API route style)
    const session = await auth(request as any, {} as any);

    console.log('[Users/Me API] Session check:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user ? (session.user as any).id : null,
    });

    if (!session?.user) {
      console.error('[Users/Me API] No authenticated session');
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

    console.log('[Users/Me API] Sending headers to backend:', {
      userId: headers['X-User-ID'],
      email: headers['X-User-Email'],
      role: headers['X-User-Role']
    });

    const response = await fetch(`${BACKEND_URL}/api/users/me`, {
      headers
    });

    if (!response.ok) {
      console.error('[Users/Me API] Fetch failed:', response.status);
      return NextResponse.json(
        { error: 'Failed to fetch user' },
        { status: response.status }
      );
    }

    const data = await response.json();
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

    // Get current session to verify authentication (NextAuth v5 API route style)
    const session = await auth(request as any, {} as any);

    if (!session?.user) {
      console.error('[Users/Me API] No authenticated session');
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

    const response = await fetch(`${BACKEND_URL}/api/users/me`, {
      method: 'PUT',
      headers,
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
