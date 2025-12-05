import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Use NextAuth's built-in middleware for proper session validation
export default withAuth(
  function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const token = (request as any).nextauth?.token;

    // Admin-only routes
    const adminRoutes = ['/admin', '/ops'];
    const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route));

    if (isAdminRoute && token?.role !== 'admin') {
      // Redirect non-admin users away from admin routes
      return NextResponse.redirect(new URL('/chat', request.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Protected routes that require authentication
        const protectedRoutes = ['/chat', '/profile', '/admin', '/ops'];
        const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

        // Allow access to protected routes only if user has a valid token
        if (isProtectedRoute) {
          return !!token;
        }

        // Allow access to all other routes
        return true;
      },
    },
    pages: {
      signIn: '/login',
    },
  }
);

export const config = {
  matcher: [
    '/chat/:path*',
    '/profile/:path*',
    '/admin/:path*',
    '/ops/:path*',
  ],
};
