import { NextResponse } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  try {
    console.log('[Me API] Fetching user info, backend URL:', BACKEND_URL);

    const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
      headers: {
        'Authorization': authHeader,
      },
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
