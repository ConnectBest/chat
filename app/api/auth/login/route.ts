import { NextResponse } from 'next/server';

// Use consistent backend URL for internal container-to-container communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    console.log('[Login API] Attempting login, backend URL:', BACKEND_URL);

    const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Login API] Login failed:', data);
      return NextResponse.json(
        { error: data.error || 'Login failed' },
        { status: response.status }
      );
    }

    console.log('[Login API] Login successful');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Login API] Login error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to authentication service' },
      { status: 500 }
    );
  }
}
