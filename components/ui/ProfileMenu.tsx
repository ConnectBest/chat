"use client";
import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/lib/useAuth';

type UserStatus = 'available' | 'away' | 'busy' | 'inmeeting' | 'offline';

const statusConfig = {
  available: { icon: '🟢', label: 'Available', color: 'bg-green-500' },
  away: { icon: '🟡', label: 'Away', color: 'bg-yellow-500' },
  busy: { icon: '🔴', label: 'Busy', color: 'bg-red-500' },
  inmeeting: { icon: '🟣', label: 'In Meeting', color: 'bg-purple-500' },
  offline: { icon: '⚫', label: 'Offline', color: 'bg-gray-500' },
};

export function ProfileMenu() {
  const router = useRouter();
  const { session, isAuthenticated } = useAuth(false);
  const [user, setUser] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<UserStatus>('available');
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch user data
  useEffect(() => {
    const fetchUser = async () => {
      if (!isAuthenticated) return;

      try {
        const response = await fetch('/api/auth/me');

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };
    fetchUser();
  }, [isAuthenticated]);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowStatusMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const isAdmin = user?.role === 'admin';
  const userName = user?.name || user?.email?.split('@')[0] || 'User';
  const userEmail = user?.email || '';
  // Use avatar from user data (includes Google profile pictures)
  const userAvatar = user?.avatar || user?.picture || undefined;

  function handleStatusChange(status: UserStatus) {
    setCurrentStatus(status);
    setShowStatusMenu(false);
    console.log('Status changed to:', status);
  }

  function handleNavigation(path: string) {
    setIsOpen(false);
    router.push(path);
  }

  async function handleSignOut() {
    // Use NextAuth signOut
    await signOut({ callbackUrl: '/login' });
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Profile Button */}
      <button
        onClick={() => {
          console.log('Profile button clicked, current isOpen:', isOpen);
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/10 transition"
        aria-label="Profile menu"
      >
        <div className="relative">
          <Avatar 
            src={userAvatar} 
            name={userName} 
            size="md"
          />
          <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-brand-900 ${statusConfig[currentStatus].color}`} />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-brand-800/95 backdrop-blur-lg border border-white/20 rounded-xl shadow-xl z-[100] overflow-hidden">
          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar 
                  src={userAvatar} 
                  name={userName} 
                  size="lg"
                />
                <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-brand-800 ${statusConfig[currentStatus].color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold flex items-center gap-2">
                  {userName}
                  {isAdmin && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded font-medium">
                      ADMIN
                    </span>
                  )}
                </div>
                <div className="text-white/60 text-sm truncate">{userEmail}</div>
                <div className="text-white/50 text-xs mt-1 flex items-center gap-1">
                  <span>{statusConfig[currentStatus].icon}</span>
                  <span>{statusConfig[currentStatus].label}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Menu Items - Scrollable */}
          <div className="max-h-[400px] overflow-y-auto scrollbar-thin py-2">
            {/* Admin-only Options */}
            {isAdmin && (
              <>
                <button
                  onClick={() => handleNavigation('/ops')}
                  className="w-full px-4 py-2.5 text-left text-white hover:bg-white/10 transition flex items-center gap-3"
                >
                  <span className="text-xl">📊</span>
                  <span className="font-medium">Ops Dashboard</span>
                </button>
                <button
                  onClick={() => handleNavigation('/admin')}
                  className="w-full px-4 py-2.5 text-left text-white hover:bg-white/10 transition flex items-center gap-3"
                >
                  <span className="text-xl">👑</span>
                  <span className="font-medium">Admin Dashboard</span>
                </button>
                <div className="border-t border-white/10 my-2" />
              </>
            )}

            {/* Profile Settings */}
            <button
              onClick={() => handleNavigation('/profile')}
              className="w-full px-4 py-2.5 text-left text-white hover:bg-white/10 transition flex items-center gap-3"
            >
              <span className="text-xl">⚙️</span>
              <span className="font-medium">Profile Settings</span>
            </button>

            {/* Add Photos */}
            <label className="w-full px-4 py-2.5 text-left text-white hover:bg-white/10 transition flex items-center gap-3 cursor-pointer">
              <span className="text-xl">📷</span>
              <span className="font-medium">Change Profile Picture</span>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  
                  // Upload file
                  const formData = new FormData();
                  formData.append('file', file);
                  
                  try {
                    // TODO: Create API route for avatar upload
                    const response = await fetch('/api/users/me/avatar', {
                      method: 'POST',
                      body: formData
                    });
                    
                    if (response.ok) {
                      const data = await response.json();
                      alert('Profile picture updated!');
                      // Refresh user data
                      window.location.reload();
                    } else {
                      alert('Failed to upload profile picture');
                    }
                  } catch (error) {
                    console.error('Error uploading avatar:', error);
                    alert('Error uploading profile picture');
                  }
                }}
              />
            </label>

            {/* Change Status */}
            <div className="relative">
              <button
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className="w-full px-4 py-2.5 text-left text-white hover:bg-white/10 transition flex items-center gap-3"
              >
                <span className="text-xl">{statusConfig[currentStatus].icon}</span>
                <span className="font-medium">Change Status</span>
                <span className="ml-auto text-white/50">›</span>
              </button>

              {/* Status Submenu */}
              {showStatusMenu && (
                <div className="absolute left-full top-0 ml-2 w-48 bg-brand-800/95 backdrop-blur-lg border border-white/20 rounded-lg shadow-xl overflow-hidden">
                  {(Object.keys(statusConfig) as UserStatus[]).map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(status)}
                      className={`w-full px-4 py-2.5 text-left text-white hover:bg-white/10 transition flex items-center gap-3 ${
                        currentStatus === status ? 'bg-white/10' : ''
                      }`}
                    >
                      <span className="text-lg">{statusConfig[status].icon}</span>
                      <span className="text-sm">{statusConfig[status].label}</span>
                      {currentStatus === status && (
                        <span className="ml-auto text-brand-400">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-white/10 my-2" />

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              className="w-full px-4 py-2.5 text-left text-red-400 hover:bg-red-500/10 transition flex items-center gap-3"
            >
              <span className="text-xl">🚪</span>
              <span className="font-medium">Sign Out</span>
            </button>
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-white/10 bg-white/5">
            <p className="text-[10px] text-white/40 text-center">
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
