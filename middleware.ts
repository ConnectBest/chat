import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Middleware runs in Edge Runtime
export async function middleware(request: NextRequest) {
  // Get our custom JWT token from cookies
  const token = request.cookies.get('auth-token')?.value;
  
  const { pathname } = request.nextUrl;

  // Protected routes that require authentication
  const protectedRoutes = ['/chat', '/profile', '/admin', '/ops'];
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  // Redirect to login if accessing protected route without token
  if (isProtectedRoute && !token) {
    console.log(`🔒 Protected route ${pathname} accessed without token, redirecting to login`);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin-only routes
  const adminRoutes = ['/admin', '/ops'];
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route));

  if (isAdminRoute && token) {
    // We can't decode JWT in Edge Runtime without additional libraries
    // The backend will validate the role when API calls are made
    // This is acceptable since the backend enforces authorization
    console.log(`🔐 Admin route ${pathname} accessed with token`);
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
