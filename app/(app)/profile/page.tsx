"use client";
import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [name, setName] = useState('');
  const [status, setStatus] = useState('Available');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name || '');
      setAvatarUrl(session.user.image || '');
    }
  }, [session]);

  async function handleSave() {
    setLoading(true);
    // Static code Backend team please change it to dynamic (PUT /api/users/me)
    await new Promise(resolve => setTimeout(resolve, 500));
    setLoading(false);
  }

  if (sessionStatus === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-600 to-brand-800 p-8 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-white text-xl">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-600 to-brand-800 p-8 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-white text-xl">Not logged in</p>
          <Button onClick={() => router.push('/login')}>Go to Login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto scrollbar-thin bg-gradient-to-br from-brand-600 to-brand-800 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-white">Profile Settings</h1>
        
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 space-y-6">
          <div className="flex items-center gap-4">
            <Avatar src={avatarUrl} name={name} size="lg" status="online" />
            <div>
              <h2 className="text-lg font-semibold text-white">{session.user.email}</h2>
              <p className="text-sm text-white/70">Role: {(session.user as any).role || 'user'}</p>
              {(session.user as any).phone && (
                <p className="text-sm text-white/70">Phone: {(session.user as any).phone}</p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white mb-2">Display Name</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
            </div>

            <div>
              <label className="block text-sm text-white mb-2">Status</label>
              <select 
                value={status} 
                onChange={e => setStatus(e.target.value)}
                className="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300"
              >
                <option value="Available">🟢 Available</option>
                <option value="Busy">🔴 Busy</option>
                <option value="Away">🟡 Away</option>
                <option value="Offline">⚫ Offline</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-white mb-2">Avatar URL</label>
              <Input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://..." />
              <p className="text-xs text-white/50 mt-1">Static code Backend team please change it to dynamic - file upload coming</p>
            </div>

            <div>
              <label className="block text-sm text-white mb-2">Notification Preferences</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-white">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span>Desktop notifications</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-white">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span>Email notifications</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-white">
                  <input type="checkbox" className="rounded" />
                  <span>Message preview in notifications</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm text-white mb-2">Timezone</label>
              <Input value={Intl.DateTimeFormat().resolvedOptions().timeZone} disabled />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={handleSave} loading={loading}>Save Changes</Button>
            <Button variant="secondary" onClick={() => window.history.back()}>Cancel</Button>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <h3 className="text-lg font-semibold text-white mb-4">Account Actions</h3>
          <div className="space-y-2">
            <Button variant="ghost" className="w-full justify-start">Change Password</Button>
            <Button variant="ghost" className="w-full justify-start">Enable 2FA</Button>
            <Button variant="danger" className="w-full justify-start">Delete Account</Button>
          </div>
          <p className="text-xs text-white/50 mt-4">Static code Backend team please change it to dynamic</p>
        </div>
      </div>
    </div>
  );
}
