"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { UserDirectory } from '@/components/chat/UserDirectory';
import { Avatar } from '@/components/ui/Avatar';
import { UserProfilePopover } from '@/components/ui/UserProfilePopover';

interface Channel { id: string; name: string; createdAt: string; }
interface DirectMessage { userId: string; userName: string; userAvatar?: string; status: 'online' | 'away' | 'offline'; lastMessage?: string; }

export function ChannelSidebar() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [open, setOpen] = useState(false);
  const [userDirOpen, setUserDirOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [clickedUser, setClickedUser] = useState<{id: string; name: string; email: string; phone?: string; status: 'online' | 'away' | 'busy' | 'inmeeting' | 'offline'; statusMessage?: string} | null>(null);
  const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    api.listChannels().then(data => setChannels(data.channels));
    // Mock DMs - Static code Backend team please change it to dynamic
    setDirectMessages([
      { userId: '2', userName: 'Alice Johnson', status: 'online' as const, lastMessage: 'Hey! How are you?' },
      { userId: '3', userName: 'Bob Smith', status: 'away' as const, lastMessage: 'See you tomorrow' },
    ]);
  }, []);

  async function createChannel() {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const { channel } = await api.createChannel(newName.trim());
      setChannels(prev => prev.find(c => c.id === channel.id) ? prev : [...prev, channel]);
      setOpen(false);
      setNewName('');
      router.push(`/chat/${channel.id}`);
      setMobileMenuOpen(false);
    } finally { setLoading(false); }
  }

  function handleSelectUser(user: { id: string; name: string; email: string; status: 'online' | 'away' | 'offline'; avatar?: string }) {
    // Check if DM already exists
    const existingDm = directMessages.find(dm => dm.userId === user.id);
    if (!existingDm) {
      setDirectMessages(prev => [...prev, { userId: user.id, userName: user.name, userAvatar: user.avatar, status: user.status }]);
    }
    setUserDirOpen(false);
    router.push(`/chat/dm/${user.id}`);
    setMobileMenuOpen(false);
  }

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-brand-800 rounded-lg border border-white/20"
        aria-label="Toggle menu"
      >
        {mobileMenuOpen ? '✕' : '☰'}
      </button>

      {/* Sidebar */}
      <aside className={`
        border-r border-white/10 flex flex-col
        fixed md:relative inset-y-0 left-0 z-40 w-64 md:w-auto
        transform transition-transform duration-300 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        bg-brand-900
      `}>
        {/* Channels Section */}
        <div className="p-4 flex items-center justify-between">
          <span className="font-semibold text-lg">Channels</span>
          <Button variant="ghost" aria-label="Create channel" onClick={() => setOpen(true)}>＋</Button>
        </div>
        <nav className="space-y-1 px-2 overflow-y-auto max-h-[200px] scrollbar-thin">
          {channels.map(c => (
            <Link
              key={c.id}
              href={`/chat/${c.id}`}
              className={`block rounded px-3 py-2 text-sm truncate ${pathname === `/chat/${c.id}` ? 'bg-white/15' : 'hover:bg-white/10'}`}
            ># {c.name}</Link>
          ))}
          {!channels.length && <div className="text-white/40 text-xs px-3">No channels</div>}
        </nav>

        {/* Direct Messages Section */}
        <div className="mt-6 px-4 flex items-center justify-between">
          <span className="font-semibold text-sm text-white/80">Direct Messages</span>
          <Button variant="ghost" aria-label="New message" onClick={() => setUserDirOpen(true)} className="text-xs">
            ✉️
          </Button>
        </div>
        <nav className="flex-1 overflow-y-auto space-y-1 px-2 mt-2">
          {directMessages.map(dm => {
            // Mock full user data - Static code Backend team please change it to dynamic
            const userMap: Record<string, { email: string; phone?: string; statusMessage?: string }> = {
              '2': { email: 'alice@example.com', phone: '+1 234-567-8901', statusMessage: 'Working on the new project 🚀' },
              '3': { email: 'bob@example.com', phone: '+1 234-567-8902', statusMessage: 'In a meeting, back soon' },
              '4': { email: 'carol@example.com', statusMessage: 'Do not disturb' },
              '5': { email: 'david@example.com', phone: '+1 234-567-8904' },
            };
            const userData = userMap[dm.userId] || { email: 'unknown@example.com' };
            
            return (
              <div
                key={dm.userId}
                className="relative"
              >
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPopoverPosition({ x: e.clientX, y: e.clientY });
                      setClickedUser({
                        id: dm.userId,
                        name: dm.userName,
                        email: userData.email,
                        phone: userData.phone,
                        status: dm.status as 'online' | 'away' | 'busy' | 'inmeeting' | 'offline',
                        statusMessage: userData.statusMessage
                      });
                    }}
                    className="flex-shrink-0 hover:opacity-80 transition"
                  >
                    <Avatar name={dm.userName} size="sm" status={dm.status} />
                  </button>
                  <Link
                    href={`/chat/dm/${dm.userId}`}
                    className={`flex-1 rounded px-3 py-2 text-sm truncate ${pathname === `/chat/dm/${dm.userId}` ? 'bg-white/15' : 'hover:bg-white/10'}`}
                  >
                    <div className="truncate">{dm.userName}</div>
                    {dm.lastMessage && <div className="text-xs text-white/50 truncate">{dm.lastMessage}</div>}
                  </Link>
                </div>
              </div>
            );
          })}
          {!directMessages.length && <div className="text-white/40 text-xs px-3">No direct messages</div>}
        </nav>

        <div className="p-2 text-[10px] text-white/40 border-t border-white/10 mt-auto">Static code Backend team please change it to dynamic</div>

        {/* Clicked User Profile */}
        {clickedUser && (
          <>
            <div 
              className="fixed inset-0 z-[60]" 
              onClick={() => setClickedUser(null)}
            />
            <div 
              className="fixed z-[70]" 
              style={{ 
                left: `${popoverPosition.x + 20}px`, 
                top: `${popoverPosition.y - 100}px` 
              }}
            >
              <UserProfilePopover
                user={clickedUser}
                onClose={() => setClickedUser(null)}
              />
            </div>
          </>
        )}

        {/* Modals */}
        <Modal title="Create Channel" open={open} onClose={() => setOpen(false)} actions={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={createChannel} loading={loading}>Create</Button>
          </>
        }>
          <label className="text-xs">Name</label>
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. engineering" />
        </Modal>

        <UserDirectory 
          open={userDirOpen} 
          onClose={() => setUserDirOpen(false)}
          onSelectUser={handleSelectUser}
          currentUserId="1" 
        />
      </aside>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </>
  );
}
