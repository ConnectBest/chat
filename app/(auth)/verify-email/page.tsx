"use client";
import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setStatus('error');
      setMessage('Verification token is missing. Please check your email link.');
      return;
    }

    verifyEmail(token);
  }, [searchParams]);

  async function verifyEmail(token: string) {
    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage(data.message || 'Your email has been verified successfully!');
        setUserName(data.user?.name || data.user?.full_name || '');
        
        // Store token for auto-login
        if (data.token) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
        }
        
        // Redirect to chat after 3 seconds
        setTimeout(() => {
          router.push('/chat');
        }, 3000);
      } else {
        setStatus('error');
        setMessage(data.error || 'Verification failed. The link may be invalid or expired.');
      }
    } catch (error) {
      setStatus('error');
      setMessage('An error occurred during verification. Please try again.');
      console.error('Verification error:', error);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-brand-900 via-brand-800 to-brand-900">
      <div className="w-full max-w-md space-y-6 rounded-xl bg-brand-800/70 backdrop-blur-lg p-8 border border-white/20 shadow-2xl">
        <div className="text-center">
          {status === 'verifying' && (
            <>
              <div className="mb-6">
                <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-brand-400"></div>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Verifying Email</h1>
              <p className="text-white/70">Please wait while we verify your email address...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 border-4 border-green-500">
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Email Verified! ✅</h1>
              {userName && (
                <p className="text-xl text-white/90 mb-3">Welcome, {userName}! 🎉</p>
              )}
              <p className="text-white/70 mb-4">{message}</p>
              <p className="text-sm text-brand-300">Redirecting to chat in 3 seconds...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 border-4 border-red-500">
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Verification Failed ❌</h1>
              <p className="text-white/70 mb-6">{message}</p>
              
              <div className="space-y-3">
                <Link href="/register">
                  <Button variant="primary" className="w-full">
                    Register Again
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="secondary" className="w-full">
                    Go to Login
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>

        {status !== 'error' && (
          <div className="pt-4 border-t border-white/10 text-center">
            <p className="text-sm text-white/60">
              Having trouble? <Link href="/login" className="text-brand-300 hover:text-brand-200 underline">Contact Support</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
