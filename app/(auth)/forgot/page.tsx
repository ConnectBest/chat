"use client";
import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Link from 'next/link';

const schema = z.object({ email: z.string().email() });

export default function ForgotPasswordPage() {
  const { register, handleSubmit, formState: { errors, isSubmitSuccessful } } = useForm<{ email: string }>({ resolver: zodResolver(schema) });

  async function onSubmit(values: { email: string }) {
    // Static code Backend team please change it to dynamic (POST /api/auth/forgot)
    console.log('Request password reset for', values.email);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 rounded-xl bg-brand-800/70 backdrop-blur-lg p-8 border border-white/20">
        <h1 className="text-2xl font-bold text-white">Reset Password</h1>
        {isSubmitSuccessful ? (
          <p className="text-sm text-green-300">If the email exists, reset instructions were sent.</p>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="block text-sm mb-1">Email</label>
              <Input type="email" {...register('email')} />
              {errors.email && <p className="text-xs text-red-300 mt-1">{errors.email.message}</p>}
            </div>
            <Button type="submit" className="w-full">Send Reset Link</Button>
          </form>
        )}
        <div className="flex justify-between text-xs text-white/70">
          <Link href="/login" className="underline">Sign in</Link>
          <Link href="/register" className="underline">Create account</Link>
        </div>
        <p className="text-xs text-white/50">Federated SSO & 2FA coming (Static code Backend team please change it to dynamic)</p>
      </div>
    </div>
  );
}
