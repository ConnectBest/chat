import { NextResponse } from 'next/server';
import { getUserHeaders } from '@/lib/apiUtils';
import type { NextRequest } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(request: NextRequest) {
  try {
    console.log('[System Metrics API] Fetching system metrics, backend URL:', BACKEND_URL);

    // Get authenticated headers with JWT token
    const authData = await getUserHeaders(request);

    if (!authData) {
      console.error('[System Metrics API] No authenticated session');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log('[System Metrics API] Session check:', {
      hasSession: true,
      userId: (authData.session.user as any).id,
      hasAuthHeaders: !!authData.headers['Authorization']
    });

    const response = await fetch(`${BACKEND_URL}/api/metrics/system`, {
      headers: authData.headers,
    });

    if (!response.ok) {
      console.error('[System Metrics API] Fetch failed:', response.status);
      // Return fallback metrics on error
      return NextResponse.json({
        activeConnections: 3,
        totalMessages: 1000,
        averageLatency: 50.0,
        errorRate: 0.5,
        cpuUsage: 30.0,
        memoryUsage: 50.0
      }, { status: 200 });
    }

    const data = await response.json();
    console.log('[System Metrics API] Successfully fetched system metrics');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[System Metrics API] Error fetching system metrics:', error);

    // Return fallback metrics on error
    return NextResponse.json({
      activeConnections: 3,
      totalMessages: 1000,
      averageLatency: 50.0,
      errorRate: 0.5,
      cpuUsage: 30.0,
      memoryUsage: 50.0
    }, { status: 200 });
  }
}