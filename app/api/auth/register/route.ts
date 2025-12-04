import { NextRequest, NextResponse } from 'next/server';

// For server-side API routes in single-container setup, Flask is on localhost:5001
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('[Register API] Attempting registration, backend URL:', BACKEND_URL);

    const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Failed to register user', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
