import { auth } from '@/lib/auth';
import type { NextRequest } from 'next/server';

/**
 * Utility function to get authenticated headers for Flask backend requests
 *
 * This function validates the NextAuth session, extracts the Flask-compatible JWT token,
 * and creates headers with Authorization Bearer token + fallback user headers.
 *
 * CRITICAL: This now includes the JWT token in Authorization header for proper
 * authentication with Flask's @token_required decorator.
 *
 * @param request - The Next.js request object
 * @returns Object containing session and headers with JWT token, or null if not authenticated
 */
export async function getUserHeaders(request: NextRequest) {
  console.log('[API Utils] 🔍 getUserHeaders called for:', request.nextUrl?.pathname);

  try {
    // CRITICAL FIX: Use proper NextAuth v5 auth() function signature
    // NextAuth v5 requires a proper request/response pair, not arbitrary objects
    const session = await auth();
    console.log('[API Utils] Session result:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userEmail: session?.user?.email,
      sessionKeys: session ? Object.keys(session) : [],
      userKeys: session?.user ? Object.keys(session.user) : []
    });

    if (!session?.user) {
      console.error('[API Utils] ❌ No authenticated session found');
      return null;
    }

    // Extract Flask-compatible JWT token from session
    const accessToken = (session.user as any).accessToken;
    const flaskAccessToken = (session.user as any).flaskAccessToken;

    console.log('[API Utils] Token analysis:', {
      hasAccessToken: !!accessToken,
      hasFlaskAccessToken: !!flaskAccessToken,
      accessTokenLength: accessToken?.length || 0,
      flaskTokenLength: flaskAccessToken?.length || 0,
      userKeys: Object.keys(session.user || {})
    });

    // Try both token fields
    const jwtToken = flaskAccessToken || accessToken;

    if (!jwtToken) {
      console.error('[API Utils] ❌ No JWT token found in session for user:', session.user.email);
      console.error('[API Utils] Session.user object:', JSON.stringify(session.user, null, 2));
      return null;
    }

    // Create headers with JWT Bearer token for Flask backend
    // Flask's @token_required decorator expects: Authorization: Bearer <jwt_token>
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`,
      // Keep user headers as fallback for backend compatibility
      'X-User-ID': (session.user as any).id,
      'X-User-Email': session.user.email || '',
      'X-User-Role': (session.user as any).role || 'user'
    };

    console.log('[API Utils] ✅ Generated authenticated headers:', {
      userEmail: session.user.email,
      hasAuthHeader: !!headers['Authorization'],
      authHeaderStart: headers['Authorization']?.substring(0, 20) + '...',
      headerKeys: Object.keys(headers)
    });

    return { session, headers };
  } catch (error) {
    console.error('[API Utils] ❌ Error in getUserHeaders:', error);
    return null;
  }
}

/**
 * Make an authenticated request to the Flask backend
 *
 * @param endpoint - The backend API endpoint (e.g., '/api/channels')
 * @param request - The Next.js API route request
 * @param options - Additional fetch options (method, body, etc.)
 * @returns The fetch Response object
 */
export async function authenticatedFetch(
  endpoint: string,
  request: NextRequest,
  options: RequestInit = {}
): Promise<Response> {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:5001';

  const authData = await getUserHeaders(request);

  if (!authData) {
    throw new Error('Authentication required');
  }

  // Merge provided headers with authenticated headers
  const mergedHeaders = {
    ...authData.headers,
    ...options.headers,
  };

  return fetch(`${backendUrl}${endpoint}`, {
    ...options,
    headers: mergedHeaders,
  });
}

