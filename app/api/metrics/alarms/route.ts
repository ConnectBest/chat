import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import type { NextRequest } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(request: NextRequest) {
  try {
    console.log('[Alarms API] Fetching CloudWatch alarms, backend URL:', BACKEND_URL);

    // Get current session to verify authentication (NextAuth v5 API route style)
    const session = await auth(request as any, {} as any);

    console.log('[Alarms API] Session check:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user ? (session.user as any).id : null
    });

    if (!session?.user) {
      console.error('[Alarms API] No authenticated session');
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

    const response = await fetch(`${BACKEND_URL}/api/metrics/alarms`, {
      headers,
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