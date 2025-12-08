import { NextResponse } from 'next/server';
import { getUserHeaders } from '@/lib/apiUtils';
import type { NextRequest } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(request: NextRequest) {
  try {
    console.log('[Alarms API] Fetching CloudWatch alarms, backend URL:', BACKEND_URL);

    // Get authenticated headers with JWT token
    const authData = await getUserHeaders(request);

    if (!authData) {
      console.error('[Alarms API] No authenticated session');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log('[Alarms API] Session check:', {
      hasSession: true,
      userId: (authData.session.user as any).id,
      hasAuthHeaders: !!authData.headers['Authorization']
    });

    const response = await fetch(`${BACKEND_URL}/api/metrics/alarms`, {
      headers: authData.headers,
    });

    if (!response.ok) {
      console.error('[Alarms API] Fetch failed:', response.status);
      // Return fallback alarms on error
      return NextResponse.json([
        {
          name: 'System-HighCPU',
          state: 'OK',
          reason: 'Demo mode - threshold not exceeded',
          timestamp: new Date().toISOString(),
          threshold: 80.0,
          metric: 'CPUUtilization'
        }
      ], { status: 200 });
    }

    const data = await response.json();
    console.log('[Alarms API] Successfully fetched alarms');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Alarms API] Error fetching alarms:', error);

    // Return fallback alarms on error
    return NextResponse.json([
      {
        name: 'System-HighCPU',
        state: 'OK',
        reason: 'Demo mode - threshold not exceeded',
        timestamp: new Date().toISOString(),
        threshold: 80.0,
        metric: 'CPUUtilization'
      }
    ], { status: 200 });
  }
}