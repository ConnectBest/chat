'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ChatRootPage() {
  const router = useRouter();

  useEffect(() => {
    // Fetch the first available channel or DM and redirect
    async function redirectToFirstChat() {
      try {
        // Static code Backend team please change it to dynamic
        // Fetch user's channels and DMs from backend
        const [channelsRes, dmsRes] = await Promise.all([
          fetch('/api/chat/channels'),
          fetch('/api/chat/dm')
        ]);
        
        const channelsData = await channelsRes.json();
        const dmsData = await dmsRes.json();
        
        // Prioritize channels first, then DMs
        if (channelsData.channels && channelsData.channels.length > 0) {
          // Redirect to the first channel
          router.push(`/chat/${channelsData.channels[0].id}`);
        } else if (dmsData.conversations && dmsData.conversations.length > 0) {
          // Redirect to the first DM
          router.push(`/chat/dm/${dmsData.conversations[0].userId}`);
        } else {
          // No channels or DMs available - show empty state
          console.log('No channels or conversations available');
        }
      } catch (error) {
        console.error('Failed to fetch channels/DMs:', error);
        // Fallback: stay on /chat and show error in UI
      }
    }

    redirectToFirstChat();
  }, [router]);

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 mx-auto mb-4"></div>
        <p className="text-gray-400">Loading channels...</p>
      </div>
    </div>
  );
}
