"use client";
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Link from 'next/link';

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  role: z.enum(['admin', 'user']),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const { register, handleSubmit, formState: { errors }, watch } = useForm<FormData>({ 
    resolver: zodResolver(schema),
    defaultValues: {
      role: 'user'
    }
  });

  const selectedRole = watch('role');

  async function onSubmit(values: FormData) {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          name: values.name,
          phone: values.phone || undefined,
          role: values.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setSuccess('✅ Registration successful! Check your email for verification code.');
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push(`/login?email=${encodeURIComponent(values.email)}`);
      }, 3000);

    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-brand-900 via-brand-800 to-brand-900">
      <div className="w-full max-w-md space-y-6 rounded-xl bg-brand-800/70 backdrop-blur-lg p-8 border border-white/20 shadow-2xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Create Account</h1>
          <p className="text-white/70 text-sm">Join ConnectBest Chat</p>
        </div>

        {error && (
          <div className="p-4 rounded-lg text-sm bg-red-500/20 border border-red-500/50 text-red-200">
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 rounded-lg text-sm bg-green-500/20 border border-green-500/50 text-green-200">
            {success}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="block text-sm mb-1 text-white/90">Full Name</label>
            <Input 
              type="text" 
              placeholder="John Doe"
              {...register('name')} 
              disabled={loading}
            />
            {errors.name && <p className="text-xs text-red-300 mt-1">{errors.name.message}</p>}
          </div>

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
            <label className="block text-sm mb-1 text-white/90">
              Phone Number (Optional)
            </label>
            <Input 
              type="tel" 
              placeholder="+1 (555) 000-0000"
              {...register('phone')} 
              disabled={loading}
            />
            {errors.phone && <p className="text-xs text-red-300 mt-1">{errors.phone.message}</p>}
          </div>

          <div>
            <label className="block text-sm mb-1 text-white/90">Password</label>
            <Input 
              type="password" 
              placeholder="At least 8 characters"
              {...register('password')} 
              disabled={loading}
            />
            {errors.password && <p className="text-xs text-red-300 mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <label className="block text-sm mb-1 text-white/90">Confirm Password</label>
            <Input 
              type="password" 
              placeholder="Re-enter password"
              {...register('confirmPassword')} 
              disabled={loading}
            />
            {errors.confirmPassword && <p className="text-xs text-red-300 mt-1">{errors.confirmPassword.message}</p>}
          </div>

          <div>
            <label className="block text-sm mb-2 text-white/90">Account Type</label>
            <div className="grid grid-cols-2 gap-3">
              <label className={`relative flex items-center justify-center p-4 rounded-lg border-2 cursor-pointer transition ${
                selectedRole === 'user' 
                  ? 'border-brand-400 bg-brand-500/20' 
                  : 'border-white/20 bg-white/5 hover:border-white/40'
              }`}>
                <input 
                  type="radio" 
                  value="user" 
                  {...register('role')} 
                  className="sr-only"
                  disabled={loading}
                />
                <div className="text-center">
                  <div className="text-3xl mb-2">👤</div>
                  <div className="font-medium text-white">User</div>
                  <div className="text-xs text-white/60">Standard access</div>
                </div>
              </label>

              <label className={`relative flex items-center justify-center p-4 rounded-lg border-2 cursor-pointer transition ${
                selectedRole === 'admin' 
                  ? 'border-purple-400 bg-purple-500/20' 
                  : 'border-white/20 bg-white/5 hover:border-white/40'
              }`}>
                <input 
                  type="radio" 
                  value="admin" 
                  {...register('role')} 
                  className="sr-only"
                  disabled={loading}
                />
                <div className="text-center">
                  <div className="text-3xl mb-2">👑</div>
                  <div className="font-medium text-white">Admin</div>
                  <div className="text-xs text-white/60">Full control</div>
                </div>
              </label>
            </div>
            {errors.role && <p className="text-xs text-red-300 mt-1">{errors.role.message}</p>}
            
            {selectedRole === 'admin' && (
              <div className="mt-2 p-3 rounded-lg bg-purple-500/10 border border-purple-500/30 text-xs text-purple-200">
                ⚠️ Admin accounts have access to Admin Dashboard and Ops Dashboard with system monitoring capabilities.
              </div>
            )}
          </div>

          <Button type="submit" className="w-full" loading={loading}>
            {loading ? 'Creating Account...' : '→ Create Account'}
          </Button>
        </form>

        <div className="text-center text-xs text-white/70">
          Already have an account?{' '}
          <Link href="/login" className="underline hover:text-white">Sign in</Link>
        </div>

        <div className="bg-white/5 rounded-lg p-3 text-[10px] text-white/40 space-y-1">
          <p>🔐 Email verification will be sent after registration</p>
          <p>📧 Check console in dev mode for verification codes</p>
          <p>🔑 Use demo@test.com / demo123 for pre-verified admin access</p>
        </div>
      </div>
    </div>
  );
}
