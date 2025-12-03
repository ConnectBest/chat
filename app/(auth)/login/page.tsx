"use client";
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Link from 'next/link';

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  verificationCode: z.string().optional(),
});

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors }, setValue } = useForm<{ 
    email: string; 
    password: string;
    verificationCode?: string;
  }>({ resolver: zodResolver(schema) });

  // Check for verification code in URL
  useEffect(() => {
    const verifyCode = searchParams.get('verify');
    if (verifyCode) {
      setValue('verificationCode', verifyCode);
      setNeedsVerification(true);
    }
  }, [searchParams, setValue]);

  async function onSubmit(values: { email: string; password: string; verificationCode?: string }) {
    setLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        email: values.email,
        password: values.password,
        verificationCode: values.verificationCode,
        redirect: false,
      });

      if (result?.error) {
        if (result.error === 'VERIFICATION_REQUIRED') {
          setNeedsVerification(true);
          setError('📧 Verification code sent to your email! Please check your inbox.');
        } else {
          setError(result.error);
        }
      } else if (result?.ok) {
        // Successful login
        const callbackUrl = searchParams.get('callbackUrl') || '/chat';
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    try {
      await signIn('google', { 
        callbackUrl: searchParams.get('callbackUrl') || '/chat' 
      });
    } catch (err) {
      setError('Google sign-in failed');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-brand-900 via-brand-800 to-brand-900">
      <div className="w-full max-w-md space-y-6 rounded-xl bg-brand-800/70 backdrop-blur-lg p-8 border border-white/20 shadow-2xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-white/70 text-sm">Sign in to ConnectBest Chat</p>
        </div>

        {error && (
          <div className={`p-4 rounded-lg text-sm ${
            error.includes('📧') 
              ? 'bg-blue-500/20 border border-blue-500/50 text-blue-200'
              : 'bg-red-500/20 border border-red-500/50 text-red-200'
          }`}>
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="block text-sm mb-1 text-white/90">Email</label>
            <Input 
              type="email" 
              placeholder="you@company.com"
              {...register('email')} 
              disabled={loading}
            />
            {errors.email && <p className="text-xs text-red-300 mt-1">{errors.email.message}</p>}
          </div>
          
          <div>
            <label className="block text-sm mb-1 text-white/90">Password</label>
            <Input 
              type="password" 
              placeholder="••••••••"
              {...register('password')} 
              disabled={loading}
            />
            {errors.password && <p className="text-xs text-red-300 mt-1">{errors.password.message}</p>}
          </div>

          {needsVerification && (
            <div>
              <label className="block text-sm mb-1 text-white/90">
                Verification Code
                <span className="text-xs text-blue-300 ml-2">(Check your email)</span>
              </label>
              <Input 
                type="text" 
                placeholder="Enter 6-digit code"
                maxLength={6}
                {...register('verificationCode')} 
                disabled={loading}
                className="text-center text-2xl tracking-widest"
              />
              {errors.verificationCode && <p className="text-xs text-red-300 mt-1">{errors.verificationCode.message}</p>}
            </div>
          )}

          <Button type="submit" className="w-full" loading={loading}>
            {needsVerification ? '🔐 Verify & Sign In' : '→ Sign In'}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/20"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-brand-800/70 text-white/70">Or continue with</span>
          </div>
        </div>

        <Button 
          variant="secondary" 
          className="w-full flex items-center justify-center gap-2"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </Button>

        <div className="flex justify-between text-xs text-white/70">
          <Link href="/register" className="underline hover:text-white">Create account</Link>
          <Link href="/forgot" className="underline hover:text-white">Forgot password?</Link>
        </div>

        <div className="bg-white/5 rounded-lg p-3 text-[10px] text-white/40">
          <p>🔐 2FA Email Verification Active</p>
          <p>📧 In development mode, check console for verification codes</p>
        </div>
      </div>
    </div>
  );
}
