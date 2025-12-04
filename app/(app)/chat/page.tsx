'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/lib/apiConfig';

export default function ChatPage() {
  const router = useRouter();
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAndRedirect = async () => {
      try {
        const token = localStorage.getItem('token');
        
        if (!token) {
          router.push('/login');
          return;
        }

        // Fetch both channels and DM conversations
        const [channelsRes, dmsRes] = await Promise.all([
          fetch(getApiUrl('chat/channels'), {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(getApiUrl('dm/conversations'), {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);

        if (channelsRes.status === 401 || dmsRes.status === 401) {
          localStorage.removeItem('token');
          router.push('/login');
          return;
        }

        const channelsData = channelsRes.ok ? await channelsRes.json() : { channels: [] };
        const dmsData = dmsRes.ok ? await dmsRes.json() : { conversations: [] };
        
        const channels = channelsData.channels || [];
        const dms = dmsData.conversations || [];
        
        setChannels(channels);

        // Combine channels and DMs, sort by most recent activity
        const allConversations = [
          ...channels.map((ch: any) => ({
            type: 'channel',
            id: ch.id || ch._id,
            lastActivity: ch.last_message_at || ch.created_at || new Date(0).toISOString()
          })),
          ...dms.map((dm: any) => ({
            type: 'dm',
            id: dm.user_id,
            lastActivity: dm.last_message_at || new Date(0).toISOString()
          }))
        ];

        // Sort by most recent activity
        allConversations.sort((a, b) => 
          new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
        );

        // Redirect to most recent conversation
        if (allConversations.length > 0) {
          const mostRecent = allConversations[0];
          if (mostRecent.type === 'channel') {
            router.push(`/chat/${mostRecent.id}`);
          } else {
            router.push(`/chat/dm/${mostRecent.id}`);
          }
        }
      } catch (error) {
        console.error('Error fetching conversations:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAndRedirect();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-400"></div>
          <p className="mt-4 text-gray-400">Loading channels...</p>
        </div>
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md p-8">
          <div className="text-6xl mb-4">💬</div>
          <h2 className="text-2xl font-bold mb-2">Welcome to ConnectBest!</h2>
          <p className="text-gray-400 mb-6">
            No channels available yet. Contact your administrator to get access to channels.
          </p>
          <button
            onClick={() => router.push('/profile')}
            className="px-6 py-3 bg-brand-600 hover:bg-brand-700 rounded-lg font-medium transition-colors"
          >
            Go to Profile
          </button>
        </div>
      </div>
    );
  }

  // This won't normally be shown as we redirect to first channel
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-400"></div>
        <p className="mt-4 text-gray-400">Redirecting to channel...</p>
      </div>
    </div>
  );
}
