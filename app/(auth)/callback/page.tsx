'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getApiUrl } from '@/lib/apiConfig';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const token = searchParams.get('token');
    const errorParam = searchParams.get('error');

    console.log('🔄 OAuth callback received');
    console.log('Token present:', !!token);
    console.log('Error present:', !!errorParam);

    // Handle error from backend
    if (errorParam) {
      console.error('❌ OAuth error:', errorParam);
      setError(decodeURIComponent(errorParam));
      setTimeout(() => {
        router.push(`/login?error=${encodeURIComponent(errorParam)}`);
      }, 3000);
      return;
    }

    // Handle missing token
    if (!token) {
      console.error('❌ No token received in callback');
      setError('No authentication token received');
      setTimeout(() => {
        router.push('/login?error=Authentication failed. No token received.');
      }, 3000);
      return;
    }

    // Validate token by trying to fetch user data
    validateAndStoreToken(token);
  }, [searchParams, router]);

  async function validateAndStoreToken(token: string) {
    try {
      console.log('🔍 Validating token...');
      
      // Verify token works by fetching user data
      const response = await fetch(getApiUrl('auth/me'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.error('❌ Token validation failed:', response.status);
        throw new Error('Invalid authentication token');
      }

      const userData = await response.json();
      console.log('✅ Token valid, user:', userData.email);

      // Store token and user data
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      // Set cookie for middleware
      document.cookie = `auth-token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
      
      console.log('💾 Token and user data stored');

      // Redirect based on user role
      const redirectUrl = userData.role === 'admin' ? '/admin' : '/chat';
      console.log('🚀 Redirecting to:', redirectUrl);
      
      router.push(redirectUrl);
      
    } catch (err) {
      console.error('💥 Token validation error:', err);
      setError('Authentication failed. Invalid token.');
      setTimeout(() => {
        router.push('/login?error=Authentication failed. Please try again.');
      }, 3000);
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-600 to-brand-800">
        <div className="text-center p-8 bg-white/10 backdrop-blur-lg rounded-xl max-w-md">
          <div className="text-red-400 text-5xl mb-4">⚠️</div>
          <h2 className="text-white text-xl font-bold mb-2">Authentication Error</h2>
          <p className="text-white/80 mb-4">{error}</p>
          <p className="text-white/60 text-sm">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-600 to-brand-800">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mb-4"></div>
        <p className="text-white text-lg font-medium">Completing sign in...</p>
        <p className="text-white/60 text-sm mt-2">Please wait while we verify your credentials</p>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-600 to-brand-800">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
          <p className="mt-4 text-white text-lg">Loading...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
