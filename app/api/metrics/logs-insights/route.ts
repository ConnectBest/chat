import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import type { NextRequest } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(request: NextRequest) {
  try {
    console.log('[Logs Insights API] Fetching logs insights, backend URL:', BACKEND_URL);

    // Get current session to verify authentication (NextAuth v5 API route style)
    const session = await auth(request as any, {} as any);

    if (!session?.user) {
      console.error('[Logs Insights API] No authenticated session');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Create headers with user info for Flask backend
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-User-ID': (session.user as any).id,
      'X-User-Email': session.user.email || '',
      'X-User-Role': (session.user as any).role || 'user'
    };

    const response = await fetch(`${BACKEND_URL}/api/metrics/logs-insights`, {
      headers,
    });

    if (!response.ok) {
      console.error('[Logs Insights API] Fetch failed:', response.status);
      // Return fallback logs insights on error
      return NextResponse.json({
        errorCount: 0,
        warningCount: 0,
        topErrors: [],
        performanceInsights: [],
        userActivity: {
          activeUsers: 0,
          peakHour: 'N/A',
          messagesSentLastHour: 0,
          newRegistrations: 0
        }
      }, { status: 200 });
    }

    const data = await response.json();
    console.log('[Logs Insights API] Successfully fetched logs insights');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Logs Insights API] Error fetching logs insights:', error);

    // Return fallback logs insights on error
    return NextResponse.json({
      errorCount: 0,
      warningCount: 0,
      topErrors: [],
      performanceInsights: [],
      userActivity: {
        activeUsers: 0,
        peakHour: 'N/A',
        messagesSentLastHour: 0,
        newRegistrations: 0
      }
    }, { status: 200 });
  }
}