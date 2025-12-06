import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import type { NextRequest } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(request: NextRequest) {
  try {
    console.log('[Me API] Fetching user info, backend URL:', BACKEND_URL);

    // Get current session to verify authentication (NextAuth v5 API route style)
    const session = await auth(request as any, {} as any);

    console.log('[Me API] Session check:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user ? (session.user as any).id : null,
      cookies: request.cookies.getAll().map(c => ({ name: c.name, hasValue: !!c.value }))
    });

    if (!session?.user) {
      console.error('[Me API] No authenticated session');
      return NextResponse.json({ user: null }, { status: 200 });
    }

    // Create headers with user info for Flask backend
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-User-ID': (session.user as any).id,
      'X-User-Email': session.user.email || '',
      'X-User-Role': (session.user as any).role || 'user'
    };

    console.log('[Me API] Sending headers to backend:', {
      userId: headers['X-User-ID'],
      email: headers['X-User-Email'],
      role: headers['X-User-Role']
    });

    const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
      headers
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
