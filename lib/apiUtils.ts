import { auth } from '@/lib/auth';
import type { NextRequest } from 'next/server';

/**
 * Utility function to get user headers from NextAuth session
 * 
 * This function validates the NextAuth session and extracts user information
 * to be sent to the Flask backend as headers.
 * 
 * @param request - The Next.js request object
 * @returns Object containing session and headers, or null if not authenticated
 */
export async function getUserHeaders(request: NextRequest) {
  const session = await auth(request as any, {} as any);

  if (!session?.user) {
    return null;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-User-ID': (session.user as any).id,
    'X-User-Email': session.user.email || '',
    'X-User-Role': (session.user as any).role || 'user'
  };

  return { session, headers };
}
