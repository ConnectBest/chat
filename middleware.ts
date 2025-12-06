import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Protected routes that require authentication
  const protectedRoutes = ['/chat', '/profile', '/admin', '/ops'];
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  // Skip middleware for API routes and static files
  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next();
  }

  if (isProtectedRoute) {
    // Check for NextAuth session token (simple existence check)
    const sessionToken = req.cookies.get('next-auth.session-token') || req.cookies.get('__Secure-next-auth.session-token');

    if (!sessionToken) {
      // No session token found, redirect to login
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Let the actual pages handle detailed authentication and role checks
  // This middleware only does basic token presence validation
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/chat/:path*',
    '/profile/:path*',
    '/admin/:path*',
    '/ops/:path*',
  ],
};
