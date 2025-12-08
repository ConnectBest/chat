'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function ChatPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAndRedirect = async () => {
      try {
        console.log('🔍 [Chat] Session status:', status, 'Session user:', !!session?.user);

        // Don't proceed if session is still loading
        if (status === 'loading') {
          console.log('⏳ [Chat] Session still loading, waiting...');
          return;
        }

        console.log('✅ [Chat] Session loaded, proceeding with auth check');

        // Check for NextAuth session
        const hasValidSession = status === 'authenticated' && session?.user;

        console.log('🔑 [Chat] Session info:', {
          status,
          hasUser: !!session?.user,
          userId: session?.user ? (session.user as any).id : null,
          isValid: hasValidSession
        });

        // Redirect to login if not authenticated
        if (status === 'unauthenticated' || !hasValidSession) {
          console.log('❌ [Chat] No valid session found, redirecting to login');
          router.push('/login');
          return;
        }

        console.log('🚀 [Chat] Valid session found, checking for cached conversation data...');

        // OPTIMIZATION: Check if ChannelSidebar has already cached the data
        // This prevents duplicate API calls when components mount simultaneously
        let cachedChannels: any[] = [];
        let cachedDMs: any[] = [];

        try {
          const channelsCache = sessionStorage.getItem('chat_channels_cache');
          const dmsCache = localStorage.getItem('activeDMs');

          if (channelsCache) {
            const cacheData = JSON.parse(channelsCache);
            // Use cached data if less than 5 seconds old
            if (Date.now() - cacheData.timestamp < 5000) {
              cachedChannels = cacheData.channels || [];
              console.log('📦 [Chat] Using cached channels:', cachedChannels.length);
            }
          }

          if (dmsCache) {
            cachedDMs = JSON.parse(dmsCache);
            console.log('📦 [Chat] Using cached DMs:', cachedDMs.length);
          }
        } catch (e) {
          console.log('⚠️ [Chat] Cache read failed, fetching fresh data');
        }

        // Only fetch if we don't have recent cached data
        if (cachedChannels.length === 0 || cachedDMs.length === 0) {
          console.log('🔄 [Chat] Fetching fresh data...');

          const [channelsRes, dmsRes] = await Promise.all([
            cachedChannels.length > 0 ? Promise.resolve({ ok: true, json: () => Promise.resolve({ channels: cachedChannels }) }) : fetch('/api/chat/channels'),
            cachedDMs.length > 0 ? Promise.resolve({ ok: true, json: () => Promise.resolve({ conversations: cachedDMs }) }) : fetch('/api/dm/conversations')
          ]);

          console.log('📡 [Chat] API responses:', {
            channels: { status: channelsRes.status, ok: channelsRes.ok },
            dms: { status: dmsRes.status, ok: dmsRes.ok }
          });

          if (channelsRes.status === 401 || dmsRes.status === 401) {
            console.log('🚫 [Chat] Got 401, session invalid - redirecting to login');
            router.push('/login');
            return;
          }

          const channelsData = channelsRes.ok ? await channelsRes.json() : { channels: [] };
          const dmsData = dmsRes.ok ? await dmsRes.json() : { conversations: [] };

          cachedChannels = channelsData.channels || [];
          cachedDMs = dmsData.conversations || [];

          // Cache the fresh data
          try {
            sessionStorage.setItem('chat_channels_cache', JSON.stringify({
              channels: cachedChannels,
              timestamp: Date.now()
            }));
            localStorage.setItem('activeDMs', JSON.stringify(cachedDMs));
          } catch (e) {
            console.log('⚠️ [Chat] Failed to cache data');
          }
        } else {
          console.log('📦 [Chat] Using cached data, skipping API calls');
        }

        // Combine channels and DMs, sort by most recent activity
        const allConversations = [
          ...cachedChannels.map((ch: any) => ({
            type: 'channel',
            id: ch.id || ch._id,
            lastActivity: ch.last_message_at || ch.created_at || new Date(0).toISOString()
          })),
          ...cachedDMs.map((dm: any) => ({
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
            console.log('🔀 [Chat] Redirecting to most recent channel:', mostRecent.id);
            router.push(`/chat/${mostRecent.id}`);
          } else {
            console.log('🔀 [Chat] Redirecting to most recent DM:', mostRecent.id);
            router.push(`/chat/dm/${mostRecent.id}`);
          }
        } else {
          console.log('ℹ️ [Chat] No conversations found, staying on main chat page');
        }
      } catch (error) {
        console.error('Error fetching conversations:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAndRedirect();
  }, [router, session, status]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-400"></div>
          <p className="mt-4 text-gray-400">
            {status === 'loading' ? 'Loading session...' : 'Loading channels...'}
          </p>
        </div>
      </div>
    );
  }

  // Check if no channels are available
  const hasChannels = (() => {
    try {
      const channelsCache = sessionStorage.getItem('chat_channels_cache');
      if (channelsCache) {
        const cacheData = JSON.parse(channelsCache);
        return (cacheData.channels || []).length > 0;
      }
    } catch (e) {
      // Fallback check
    }
    return false;
  })();

  if (!hasChannels) {
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
