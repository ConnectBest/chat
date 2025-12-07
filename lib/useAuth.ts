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
