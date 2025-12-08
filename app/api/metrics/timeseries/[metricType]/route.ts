import { NextResponse } from 'next/server';
import { getUserHeaders } from '@/lib/apiUtils';
import type { NextRequest } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ metricType: string }> }
) {
  const { metricType } = await params;
  const { searchParams } = new URL(request.url);

  // Extract query parameters
  const period = searchParams.get('period') || '60';
  const points = searchParams.get('points') || '20';

  try {
    console.log(`[Timeseries API] Fetching ${metricType} timeseries, backend URL:`, BACKEND_URL);

    // Get authenticated headers with JWT token
    const authData = await getUserHeaders(request);

    if (!authData) {
      console.error('[Timeseries API] No authenticated session');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log('[Timeseries API] Session check:', {
      hasSession: true,
      userId: (authData.session.user as any).id,
      hasAuthHeaders: !!authData.headers['Authorization']
    });

    const queryString = `period=${period}&points=${points}`;
    const response = await fetch(`${BACKEND_URL}/api/metrics/timeseries/${metricType}?${queryString}`, {
      headers: authData.headers,
    });

    if (!response.ok) {
      console.error('[Timeseries API] Fetch failed:', response.status);
      // Return fallback data on error
      return NextResponse.json(generateFallbackData(metricType, parseInt(points)), { status: 200 });
    }

    const data = await response.json();
    console.log(`[Timeseries API] Successfully fetched ${metricType} timeseries`);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Timeseries API] Error fetching timeseries:', error);

    // Return fallback data on error
    return NextResponse.json(generateFallbackData(metricType, parseInt(points)), { status: 200 });
  }
}

function generateFallbackData(metricType: string, points: number) {
  const now = new Date();
  const data = [];

  const ranges = {
    'cpu': { min: 20, max: 60 },
    'memory': { min: 30, max: 80 },
    'connections': { min: 1, max: 10 },
    'latency': { min: 20, max: 80 },
    'errors': { min: 0, max: 3 }
  };

  const range = ranges[metricType as keyof typeof ranges] || { min: 0, max: 100 };

  for (let i = points - 1; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - (i * 30000)); // 30 second intervals
    let value = Math.random() * (range.max - range.min) + range.min;

    if (metricType === 'errors') {
      value = Math.floor(value);
    } else {
      value = Math.round(value * 10) / 10;
    }

    data.push({
      timestamp: timestamp.toISOString(),
      value: value
    });
  }

  return data;
}