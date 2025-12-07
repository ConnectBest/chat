/**
 * Custom useAuth hook wrapping NextAuth's useSession
 * Provides a convenient interface for authentication state
 */
"use client";
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function useAuth(required = false) {
  const session = useSession();
  const router = useRouter();
  
  const isAuthenticated = session.status === 'authenticated';
  
  useEffect(() => {
    // Don't redirect while still loading authentication status
    if (session.status === 'loading') return;
    
    if (required && session.status === 'unauthenticated') {
      router.push('/login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [required, session.status]); // router is stable and doesn't need to be in deps
  
  return {
    session: session.data,
    status: session.status,
    isAuthenticated,
  };
}
