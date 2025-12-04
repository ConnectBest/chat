import { NextResponse } from 'next/server';

const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  
  try {
    const response = await fetch(`${BACKEND_API_URL}/chat/channels`, {
      headers: authHeader ? { 'Authorization': authHeader } : {},
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch channels' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching channels:', error);
    return NextResponse.json(
      { error: 'Failed to connect to chat service' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  
  try {
    const body = await request.json().catch(() => ({}));
    
    const response = await fetch(`${BACKEND_API_URL}/chat/channels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { 'Authorization': authHeader }),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to create channel' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating channel:', error);
    return NextResponse.json(
      { error: 'Failed to connect to chat service' },
      { status: 500 }
    );
  }
}
