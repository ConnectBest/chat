import { NextRequest, NextResponse } from 'next/server';

const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch(`${BACKEND_API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Login failed' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Proxy login error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to authentication service' },
      { status: 500 }
    );
  }
}
