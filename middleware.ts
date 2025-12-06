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
    // Check for NextAuth v5 session tokens (authjs prefix, not next-auth)
    const sessionTokens = [
      req.cookies.get('__Secure-authjs.session-token'), // NextAuth v5 primary
      req.cookies.get('__Host-authjs.session-token'),   // Alternative secure format
      req.cookies.get('authjs.session-token'),          // Fallback non-secure
      req.cookies.get('next-auth.session-token'),       // Legacy v4 format
      req.cookies.get('__Secure-next-auth.session-token'), // Legacy v4 secure
    ];

    const hasSessionToken = sessionTokens.some(token => token && token.value);

    console.log('🔍 [Middleware] Route check:', {
      pathname,
      isProtected: isProtectedRoute,
      sessionTokens: sessionTokens.map(t => ({ name: t?.name, hasValue: !!t?.value })),
      hasSession: hasSessionToken,
      allCookies: Array.from(req.cookies.getAll().map(c => c.name))
    });

    if (!hasSessionToken) {
      console.log('❌ [Middleware] No valid session token found, redirecting to login');
      // No session token found, redirect to login
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    console.log('✅ [Middleware] Session token found, allowing access');
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
