"use client";
/**
 * Custom useAuth hook wrapping NextAuth's useSession
 * Provides a convenient interface for authentication state
 * 
 * @param required - If true, redirects to /login when unauthenticated
 * @returns Authentication state with session, status, and isAuthenticated flag
 * 
 * Note: The Next.js router object is stable and excluded from useEffect deps
 */
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
  }, [required, session.status, router]);
  
  return {
    session: session.data,
    status: session.status,
    isAuthenticated,
  };
}
