import { NextRequest, NextResponse } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('[Proxy Login API] Attempting login, backend URL:', BACKEND_URL);

    const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Proxy Login API] Login failed:', data);
      return NextResponse.json(
        { error: data.message || 'Login failed' },
        { status: response.status }
      );
    }

    console.log('[Proxy Login API] Login successful');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Proxy Login API] Proxy login error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to authentication service' },
      { status: 500 }
    );
  }
}
