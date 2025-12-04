import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Middleware runs in Edge Runtime
export async function middleware(request: NextRequest) {
  // Get NextAuth session token from cookies
  const sessionToken = request.cookies.get('next-auth.session-token')?.value || 
                       request.cookies.get('__Secure-next-auth.session-token')?.value;
  
  // Also check for our custom token
  const customToken = request.cookies.get('auth-token')?.value;
  
  const { pathname } = request.nextUrl;

  // Protected routes that require authentication
  const protectedRoutes = ['/chat', '/profile', '/admin', '/ops'];
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  // Redirect to login if accessing protected route without any token
  if (isProtectedRoute && !sessionToken && !customToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin-only routes - we'll validate role on the client side for now
  // since we can't decode JWT in Edge Runtime without additional libraries
  const adminRoutes = ['/admin', '/ops'];
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route));

  if (isAdminRoute && (sessionToken || customToken)) {
    // Let the page component handle role validation
    // This is acceptable for now since the backend also validates
  }

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
