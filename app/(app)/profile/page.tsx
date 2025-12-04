"use client";
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getApiUrl } from '@/lib/apiConfig';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('Available');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        
        if (!token) {
          router.push('/login');
          return;
        }

        const response = await fetch(getApiUrl('auth/me'), {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          setName(data.user.name || '');
          setAvatarUrl(data.user.avatar || '');
        } else if (response.status === 401) {
          // Token invalid
          localStorage.removeItem('token');
          document.cookie = 'auth-token=; path=/; max-age=0';
          router.push('/login');
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [router]);

  async function handleSave() {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(getApiUrl('users/me'), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name,
          avatar: avatarUrl,
          status_message: status
        })
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        alert('Profile updated successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to update profile: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-600 to-brand-800 p-8 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
          <p className="text-white text-xl">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!user) {
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
        <div className="flex items-center gap-4">
          <Link 
            href="/chat"
            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors group"
          >
            <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Chat
          </Link>
          <h1 className="text-3xl font-bold text-white">Profile Settings</h1>
        </div>
        
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 space-y-6">
          <div className="flex items-center gap-4">
            <Avatar src={avatarUrl} name={name} size="lg" status="online" />
            <div>
              <h2 className="text-lg font-semibold text-white">{user.email}</h2>
              <p className="text-sm text-white/70">Role: {user.role || 'user'}</p>
              {user.phone && (
                <p className="text-sm text-white/70">Phone: {user.phone}</p>
              )}
              {user.username && (
                <p className="text-sm text-white/70">Username: @{user.username}</p>
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
              <label className="block text-sm text-white mb-2">Profile Picture</label>
              <div className="space-y-3">
                <Input 
                  type="file" 
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // Validate file size (5MB max)
                      if (file.size > 5 * 1024 * 1024) {
                        alert('File is too large. Maximum size is 5MB.');
                        return;
                      }

                      // Upload file to server
                      setUploading(true);
                      try {
                        const token = localStorage.getItem('token');
                        if (!token) {
                          alert('Please login first');
                          return;
                        }

                        const formData = new FormData();
                        formData.append('file', file);

                        const response = await fetch(getApiUrl('users/me/avatar'), {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${token}`
                          },
                          body: formData
                        });

                        if (response.ok) {
                          const data = await response.json();
                          setAvatarUrl(data.avatar_url);
                          alert('Image uploaded successfully!');
                        } else {
                          const error = await response.json();
                          alert(`Upload failed: ${error.error || 'Unknown error'}`);
                        }
                      } catch (error) {
                        console.error('Upload error:', error);
                        alert('Failed to upload image');
                      } finally {
                        setUploading(false);
                      }
                    }
                  }}
                  className="text-white/70"
                  disabled={uploading}
                />
                {uploading && (
                  <div className="flex items-center gap-2 text-sm text-white/70">
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                    Uploading...
                  </div>
                )}
                <Input 
                  value={avatarUrl} 
                  onChange={e => setAvatarUrl(e.target.value)} 
                  placeholder="Or enter image URL..." 
                />
                <p className="text-xs text-white/50">Upload from gallery (max 5MB) or paste image URL</p>
              </div>
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
            <Button onClick={handleSave} loading={saving}>Save Changes</Button>
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
        </div>
      </div>
    </div>
  );
}
