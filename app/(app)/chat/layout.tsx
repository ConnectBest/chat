import React from 'react';
import { ChannelSidebar } from '@/components/chat/ChannelSidebar';
import { ProfileMenu } from '@/components/ui/ProfileMenu';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
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
