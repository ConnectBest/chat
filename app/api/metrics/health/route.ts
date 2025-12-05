import { NextResponse } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET() {
  try {
    console.log('[Health API] Fetching health status, backend URL:', BACKEND_URL);

    const response = await fetch(`${BACKEND_URL}/api/metrics/health`);

    if (!response.ok) {
      console.error('[Health API] Fetch failed:', response.status);
      // Return fallback health status on error
      return NextResponse.json({
        status: 'degraded',
        uptime: 95.0,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        services: {
          api: { status: 'degraded', error: 'Connection failed' }
        }
      }, { status: 200 });
    }

    const data = await response.json();
    console.log('[Health API] Successfully fetched health status');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Health API] Error fetching health status:', error);

    // Return fallback health status on error
    return NextResponse.json({
      status: 'degraded',
      uptime: 95.0,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      services: {
        api: { status: 'degraded', error: String(error) }
      }
    }, { status: 200 });
  }
}