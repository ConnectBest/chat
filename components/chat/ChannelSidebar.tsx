"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { UserDirectory } from '@/components/chat/UserDirectory';
import { Avatar } from '@/components/ui/Avatar';
import { UserProfilePopover } from '@/components/ui/UserProfilePopover';
import { useAuth } from '@/lib/useAuth';

interface Channel { id: string; name: string; createdAt: string; }
interface DirectMessage {
  userId: string;
  userName: string;
  userAvatar?: string;
  status: 'online' | 'away' | 'offline';
  lastMessage?: string;
  unreadCount?: number;
  lastMessageAt?: string;
}

export function ChannelSidebar() {
  const { isAuthenticated } = useAuth(true);
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
    if (!isAuthenticated) return;

    // Initialize DMs from localStorage on mount
    const storedDMs = JSON.parse(localStorage.getItem('activeDMs') || '[]');
    if (storedDMs.length > 0) {
      setDirectMessages(storedDMs);
    }

    const fetchChannels = async () => {
      try {
        console.log('Fetching channels via Next.js API route');
        const response = await fetch('/api/chat/channels');

        console.log('Channels response status:', response.status);
        if (response.ok) {
          const data = await response.json();
          console.log('Channels data:', data);
          setChannels(data.channels || []);
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('Failed to fetch channels:', response.status, errorData);
          setChannels([]);
        }
      } catch (error) {
        console.error('Error fetching channels:', error);
        setChannels([]);
      }
    };

    const fetchDMConversations = async () => {
      try {
        console.log('Fetching DM conversations via Next.js API route');
        const response = await fetch('/api/dm/conversations');
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('DM conversations response:', data);
        const apiConversations = data.conversations || [];

        // Get locally stored DMs (from when user clicked on users)
        const storedDMs = JSON.parse(localStorage.getItem('activeDMs') || '[]');

        // Merge API conversations with stored DMs, API takes precedence
        const allDMs = [...storedDMs];

        apiConversations.forEach((conv: any) => {
          const existingIndex = allDMs.findIndex(dm => dm.userId === conv.user_id);
          const dmData = {
            userId: conv.user_id,
            userName: conv.user_name,
            userAvatar: conv.user_avatar,
            status: conv.user_status || 'offline',
            lastMessage: conv.last_message,
            unreadCount: conv.unreadCount || 0,
            lastMessageAt: conv.last_message_at
          };

          if (existingIndex >= 0) {
            // Update existing DM with API data
            allDMs[existingIndex] = dmData;
          } else {
            // Add new DM from API
            allDMs.push(dmData);
          }
        });

        // Sort by last message time, putting DMs with recent activity first
        allDMs.sort((a, b) => {
          const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return bTime - aTime;
        });

        setDirectMessages(allDMs);

        // Update localStorage with merged DMs
        localStorage.setItem('activeDMs', JSON.stringify(allDMs));

      } catch (error: any) {
        console.error('Error fetching DM conversations:', error);
        console.error('Error details:', error.response?.data);

        // Fallback to stored DMs if API fails
        const storedDMs = JSON.parse(localStorage.getItem('activeDMs') || '[]');
        setDirectMessages(storedDMs);
      }
    };

    fetchChannels();
    fetchDMConversations();

    // Note: Removed event listener that was causing excessive API calls
    // Unread counts will be updated on next natural refresh
  }, [isAuthenticated]);

  // Function to manually refresh counts (called by ChannelView after marking as read)
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleRefreshSidebar = () => {
      const refreshCounts = async () => {
        try {
          const [channelsRes, conversationsRes] = await Promise.all([
            fetch('/api/chat/channels'),
            fetch('/api/dm/conversations')
          ]);

          if (channelsRes.ok) {
            const channelsData = await channelsRes.json();
            setChannels((channelsData.channels || []).map((ch: any) => ({
              id: ch.id,
              name: ch.name,
              description: ch.description,
              unreadCount: ch.unreadCount || 0
            })));
          }

          if (conversationsRes.ok) {
            const convsData = await conversationsRes.json();
            setDirectMessages((convsData.conversations || []).map((conv: any) => ({
              userId: conv.user_id,
              userName: conv.user_name,
              userAvatar: conv.user_avatar,
              status: conv.user_status || 'offline',
              lastMessage: conv.last_message,
              unreadCount: conv.unreadCount || 0
            })));
          }
        } catch (error) {
          console.error('Error refreshing sidebar:', error);
        }
      };
      refreshCounts();
    };

    window.addEventListener('refreshSidebar', handleRefreshSidebar);
    return () => window.removeEventListener('refreshSidebar', handleRefreshSidebar);
  }, [isAuthenticated]);

  async function createChannel() {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      // Session is already validated by useAuth hook
      console.log('Creating channel with name:', newName.trim());
      const response = await fetch('/api/chat/channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newName.trim() })
      });

      console.log('Channel creation response status:', response.status);
      const data = await response.json();
      console.log('Channel creation response data:', data);

      if (response.ok) {
        const channel = data.channel;
        setChannels(prev => prev.find(c => c.id === channel.id) ? prev : [...prev, channel]);
        setOpen(false);
        setNewName('');
        router.push(`/chat/${channel.id}`);
        setMobileMenuOpen(false);
      } else if (response.status === 401) {
        router.push('/login');
      } else {
        console.error('Channel creation failed:', data);
        alert(`Failed to create channel: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating channel:', error);
      alert(`Error creating channel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally { 
      setLoading(false); 
    }
  }

  function handleSelectUser(user: { id: string; name: string; email: string; status: 'online' | 'away' | 'offline'; avatar?: string }) {
    // Check if DM already exists
    const existingDm = directMessages.find(dm => dm.userId === user.id);

    const dmData = {
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar,
      status: user.status,
      lastMessage: existingDm?.lastMessage,
      unreadCount: existingDm?.unreadCount || 0
    };

    if (!existingDm) {
      // Add to state
      setDirectMessages(prev => [...prev, dmData]);

      // Also store in localStorage so it persists
      const storedDMs = JSON.parse(localStorage.getItem('activeDMs') || '[]');
      const updatedDMs = storedDMs.filter((dm: any) => dm.userId !== user.id);
      updatedDMs.push(dmData);
      localStorage.setItem('activeDMs', JSON.stringify(updatedDMs));
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
              className={`flex items-center justify-between rounded px-3 py-2 text-sm truncate ${pathname === `/chat/${c.id}` ? 'bg-white/15' : 'hover:bg-white/10'}`}
            >
              <span className={(c as any).unreadCount > 0 ? 'font-bold' : ''}># {c.name}</span>
              {(c as any).unreadCount > 0 && (
                <span className="bg-gray-500/50 text-white text-xs font-semibold rounded-full px-2 py-0.5 min-w-[20px] text-center">
                  {(c as any).unreadCount}
                </span>
              )}
            </Link>
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
            const userData = { email: dm.userId + '@example.com' };
            
            return (
              <Link
                key={dm.userId}
                href={`/chat/dm/${dm.userId}`}
                className={`flex items-center gap-2 rounded px-2 py-2 ${pathname === `/chat/dm/${dm.userId}` ? 'bg-white/15' : 'hover:bg-white/10'}`}
              >
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Opening popover for user:', dm.userName);
                    setPopoverPosition({ x: e.clientX, y: e.clientY });
                    setClickedUser({
                      id: dm.userId,
                      name: dm.userName,
                      email: userData.email,
                      status: dm.status as 'online' | 'away' | 'busy' | 'inmeeting' | 'offline',
                    });
                  }}
                  className="flex-shrink-0 hover:opacity-80 transition"
                >
                  <Avatar src={dm.userAvatar} name={dm.userName} size="sm" status={dm.status} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`truncate ${(dm as any).unreadCount > 0 ? 'font-bold' : ''}`}>
                      {dm.userName || dm.userId || 'Unknown User'}
                    </span>
                    {(dm as any).unreadCount > 0 && (
                      <span className="bg-gray-500/50 text-white text-xs font-semibold rounded-full px-2 py-0.5 min-w-[20px] text-center flex-shrink-0">
                        {(dm as any).unreadCount}
                      </span>
                    )}
                  </div>
                  {dm.lastMessage && <div className="text-xs text-white/50 truncate">{dm.lastMessage}</div>}
                </div>
              </Link>
            );
          })}
          {!directMessages.length && <div className="text-white/40 text-xs px-3">No direct messages</div>}
        </nav>



        {/* Clicked User Profile */}
        {clickedUser && (
          <>
            <div 
              className="fixed inset-0 z-[60]" 
              onClick={() => {
                console.log('Closing popover for user:', clickedUser.name);
                setClickedUser(null);
              }}
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
