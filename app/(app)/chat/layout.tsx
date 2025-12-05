"use client";
import React, { useEffect } from 'react';
import { useAuth } from '@/lib/useAuth';
import { ChannelSidebar } from '@/components/chat/ChannelSidebar';
import { ProfileMenu } from '@/components/ui/ProfileMenu';
import { getApiUrl } from '@/lib/apiConfig';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const { data: session, token } = useAuth();
  
  useEffect(() => {
    // Set user status to online when chat loads
    const setOnlineStatus = async () => {
      try {
        if (!token) return;

        const response = await fetch(getApiUrl('users/me'), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ status: 'online' })
        });

        if (!response.ok) {
          console.warn('Failed to set online status:', response.status);
        }
      } catch (error) {
        // Silently fail - online status is not critical
        console.warn('Failed to set online status:', error);
      }
    };

    if (session?.user) {
      setOnlineStatus();

      // Send heartbeat every 30 seconds to keep user online
      const heartbeatInterval = setInterval(setOnlineStatus, 30000);

      // Set user to offline when leaving
      const handleBeforeUnload = async () => {
        try {
          if (!token) return;

          navigator.sendBeacon(
            getApiUrl('users/me'),
            new Blob([JSON.stringify({ status: 'offline' })], { type: 'application/json' })
          );
        } catch (error) {
          console.error('Failed to set offline status:', error);
        }
      };

      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        clearInterval(heartbeatInterval);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [session]);

  return (
    <div className="h-screen overflow-hidden grid grid-cols-1 md:grid-cols-[260px_1fr] bg-brand-900 text-white">
      <ChannelSidebar />
      <div className="flex flex-col h-screen overflow-hidden">
        {/* Top Bar with Profile Menu */}
        <div className="flex-shrink-0 h-16 border-b border-white/10 bg-brand-900/50 flex items-center justify-between px-4">
          <div className="flex-1" />
          <ProfileMenu />
        </div>
        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
