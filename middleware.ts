import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Middleware runs in Edge Runtime - cannot import nodemailer or Node.js modules
export async function middleware(request: NextRequest) {
  // ✅ 這裡先算出 secret，跟 lib/auth.ts 裡的邏輯一致
  const secret = process.env.NEXTAUTH_SECRET || 'development-secret-change-in-production';

  const token = await getToken({ 
    req: request,
    secret,
  });
  
  const { pathname } = request.nextUrl;

  // Protected routes that require authentication
  const protectedRoutes = ['/chat', '/profile', '/admin', '/ops'];
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  // Admin-only routes
  const adminRoutes = ['/admin', '/ops'];
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route));

  // Redirect to login if accessing protected route without session
  if (isProtectedRoute && !token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check admin access for admin-only routes
  if (isAdminRoute && token) {
    const userRole = (token as any)?.role;
    
    if (userRole !== 'admin') {
      // Redirect non-admin users to chat with error message
      const chatUrl = new URL('/chat/general', request.url);
      chatUrl.searchParams.set('error', 'unauthorized');
      return NextResponse.redirect(chatUrl);
    }
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