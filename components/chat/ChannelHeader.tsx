"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CallControls } from './CallControls';
import { NotificationSettings } from './NotificationSettings';
import { HuddlePanel } from './HuddlePanel';
import { CanvasEditor } from './CanvasEditor';
import { api } from '@/lib/api';
import { getApiUrl } from '@/lib/apiConfig';

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  status: 'online' | 'away' | 'offline';
}

interface ChannelHeaderProps {
  channelId: string;
  channelName: string;
  memberCount: number;
  onUpdateChannel?: (name: string, members: string[]) => void;
}

export function ChannelHeader({ channelId, channelName, memberCount, onUpdateChannel }: ChannelHeaderProps) {
  const { data: session } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [showRenameChannel, setShowRenameChannel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newChannelName, setNewChannelName] = useState(channelName);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [channelMembers, setChannelMembers] = useState<User[]>([]);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showHuddle, setShowHuddle] = useState(false);
  const [showCanvas, setShowCanvas] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Helper function to get token from either localStorage or NextAuth session
  const getToken = () => {
    const localToken = localStorage.getItem('token');
    const sessionToken = (session?.user as any)?.accessToken;
    return localToken || sessionToken;
  };

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load users and channel members
  useEffect(() => {
    async function loadData() {
      const token = getToken();
      if (!token) return;

      try {
        // Load all users
        const usersResponse = await fetch(getApiUrl('users'), {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          setAllUsers(usersData.users || []);
        }

        // Load channel details with members
        const channelData = await api.getChannelDetails(channelId, token);
        if (channelData.channel && channelData.channel.members) {
          const members = channelData.channel.members.map((m: any) => ({
            id: m.user_id,
            name: m.name || 'Unknown',
            email: m.email || '',
            avatar: m.avatar_url || m.avatar,
            status: m.status || 'offline' as const
          }));
          setChannelMembers(members);
        }
      } catch (error: any) {
        console.error('Failed to load data:', error);
        console.error('Error details:', error.response?.data || error.message);
        // Set empty arrays on error to prevent UI breaking
        setAllUsers([]);
        setChannelMembers([]);
      }
    }

    loadData();
  }, [channelId, session]); // Add session to dependencies

  // Search users by name, email, or phone
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results = allUsers.filter(user => {
      const isAlreadyMember = channelMembers.some(m => m.id === user.id);
      if (isAlreadyMember) return false;

      return (
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.phone?.includes(query)
      );
    });

    setSearchResults(results);
  }, [searchQuery, allUsers, channelMembers]);

  function handleAddMember(user: User) {
    const token = getToken();
    if (!token) {
      console.error('No authentication token available');
      alert('Authentication error. Please try logging in again.');
      return;
    }

    console.log('Adding member:', user.id, 'to channel:', channelId);

    // Add to backend
    api.addChannelMember(channelId, user.id, token)
      .then(() => {
        setChannelMembers(prev => [...prev, user]);
        setSearchQuery('');
        setSearchResults([]);
        console.log('✅ Added member successfully:', user);
      })
      .catch(error => {
        console.error('❌ Failed to add member:', error);
        console.error('Error details:', error.response?.data || error.message);
        alert(`Failed to add member: ${error.response?.data?.error || error.message}`);
      });
  }

  function handleRemoveMember(userId: string) {
    const token = getToken();
    if (!token) return;

    // Remove from backend
    api.removeChannelMember(channelId, userId, token)
      .then(() => {
        setChannelMembers(prev => prev.filter(m => m.id !== userId));
        console.log('Removed member:', userId);
      })
      .catch(error => {
        console.error('Failed to remove member:', error);
        alert('Failed to remove member from channel');
      });
  }

  function handleRenameChannel() {
    if (!newChannelName.trim() || newChannelName === channelName) {
      setShowRenameChannel(false);
      return;
    }
    
    console.log('Renamed channel to:', newChannelName);
    onUpdateChannel?.(newChannelName, channelMembers.map(m => m.id));
    setShowRenameChannel(false);
    setIsMenuOpen(false);
  }

  function toggleLock() {
    setIsLocked(!isLocked);
    console.log(`Channel ${isLocked ? 'unlocked (public)' : 'locked (private)'}:`, channelId);
  }

  return (
    <div className="flex-shrink-0 px-4 py-3 border-b border-white/10 bg-brand-900/50 flex items-center gap-3">
      {/* Channel Name */}
      <h2 className="font-semibold flex items-center gap-2">
        <span className="text-white/70">#</span> {channelName}
        {/* Lock/Unlock Indicator */}
        {isLocked ? (
          <span className="text-red-400" title="Private Channel">🔒</span>
        ) : (
          <span className="text-green-400" title="Public Channel">🔓</span>
        )}
      </h2>

      {/* Member Count */}
      <div className="flex items-center gap-1 px-2 py-1 rounded bg-white/10 text-xs text-white/70">
        <span>👥</span>
        <span>{channelMembers.length}</span>
      </div>

      {/* Spacer to push items to right */}
      <div className="flex-1" />

      {/* Huddle Button */}
      <button
        onClick={() => setShowHuddle(!showHuddle)}
        className="px-3 py-1.5 bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 rounded-lg transition flex items-center gap-2 text-sm font-medium"
        title="Start a huddle"
      >
        🎧 Huddle
      </button>

      {/* Canvas Button */}
      <button
        onClick={() => setShowCanvas(true)}
        className="px-3 py-1.5 bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 rounded-lg transition flex items-center gap-2 text-sm font-medium"
        title="Open Canvas"
      >
        📄 Canvas
      </button>

      {/* Call Controls */}
      <CallControls channelId={channelId} isDM={false} />

      {/* Menu Dropdown */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="p-2 hover:bg-white/10 rounded transition text-white/70 hover:text-white"
          aria-label="Channel options"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 6l4 4 4-4z" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {isMenuOpen && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-brand-800/95 backdrop-blur-lg border border-white/20 rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="p-3 border-b border-white/10 bg-white/5">
              <h3 className="font-semibold text-white text-sm">Channel Settings</h3>
            </div>

            <div className="max-h-[500px] overflow-y-auto scrollbar-thin">
              {/* Add Members Section */}
              <div className="p-3 border-b border-white/10">
                <button
                  onClick={() => setShowAddMembers(!showAddMembers)}
                  className="w-full flex items-center justify-between text-white hover:bg-white/10 p-2 rounded transition"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-lg">➕</span>
                    <span className="font-medium text-sm">Add Members</span>
                  </span>
                  <span className="text-white/50">{showAddMembers ? '▼' : '▶'}</span>
                </button>

                {showAddMembers && (
                  <div className="mt-3 space-y-2">
                    <Input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search by name, email, or phone..."
                      className="text-sm"
                    />

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                      <div className="max-h-48 overflow-y-auto scrollbar-thin space-y-1 bg-white/5 rounded-lg p-2">
                        {searchResults.map(user => (
                          <button
                            key={user.id}
                            onClick={() => handleAddMember(user)}
                            className="w-full flex items-center gap-2 p-2 hover:bg-white/10 rounded transition text-left"
                          >
                            <Avatar src={user.avatar} name={user.name} status={user.status} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="text-white text-sm font-medium truncate">{user.name}</div>
                              <div className="text-white/50 text-xs truncate">{user.email}</div>
                              {user.phone && (
                                <div className="text-white/40 text-xs">{user.phone}</div>
                              )}
                            </div>
                            <span className="text-brand-400 text-xs">Add</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {searchQuery && searchResults.length === 0 && (
                      <div className="text-white/50 text-xs text-center py-2">
                        No users found
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Current Members List */}
              <div className="p-3 border-b border-white/10">
                <div className="text-white/70 text-xs font-medium mb-2">
                  Members ({channelMembers.length})
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
                  {channelMembers.map(member => (
                    <div
                      key={member.id}
                      className="flex items-center gap-2 p-2 rounded bg-white/5 group"
                    >
                      <Avatar src={member.avatar} name={member.name} status={member.status} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium truncate">{member.name}</div>
                        <div className="text-white/50 text-xs truncate">{member.email}</div>
                      </div>
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs transition"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rename Channel Section */}
              <div className="p-3 border-b border-white/10">
                <button
                  onClick={() => setShowRenameChannel(!showRenameChannel)}
                  className="w-full flex items-center justify-between text-white hover:bg-white/10 p-2 rounded transition"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-lg">✏️</span>
                    <span className="font-medium text-sm">Rename Channel</span>
                  </span>
                  <span className="text-white/50">{showRenameChannel ? '▼' : '▶'}</span>
                </button>

                {showRenameChannel && (
                  <div className="mt-3 space-y-2">
                    <Input
                      value={newChannelName}
                      onChange={e => setNewChannelName(e.target.value)}
                      placeholder="New channel name"
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setNewChannelName(channelName);
                          setShowRenameChannel(false);
                        }}
                        className="text-xs flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleRenameChannel}
                        className="text-xs flex-1"
                        disabled={!newChannelName.trim() || newChannelName === channelName}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Lock/Unlock Channel Section */}
              <div className="p-3">
                <button
                  onClick={toggleLock}
                  className="w-full flex items-center justify-between text-white hover:bg-white/10 p-2 rounded transition"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-lg">{isLocked ? '🔒' : '🔓'}</span>
                    <div className="text-left">
                      <div className="font-medium text-sm">
                        {isLocked ? 'Unlock Channel' : 'Lock Channel'}
                      </div>
                      <div className="text-xs text-white/50">
                        {isLocked ? 'Make channel public' : 'Make channel private'}
                      </div>
                    </div>
                  </span>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    isLocked 
                      ? 'bg-red-500/20 text-red-300' 
                      : 'bg-green-500/20 text-green-300'
                  }`}>
                    {isLocked ? 'Private' : 'Public'}
                  </div>
                </button>
              </div>

              {/* Notification Settings Section */}
              <div className="p-3 border-t border-white/10">
                <button
                  onClick={() => {
                    setShowNotificationSettings(true);
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 text-white hover:bg-white/10 p-2 rounded transition"
                >
                  <span className="text-lg">🔔</span>
                  <div className="text-left">
                    <div className="font-medium text-sm">Notification Settings</div>
                    <div className="text-xs text-white/50">
                      Manage alerts for this channel
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div className="p-2 border-t border-white/10 bg-white/5">
              <p className="text-[10px] text-white/40 text-center">
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Notification Settings Modal */}
      {showNotificationSettings && (
        <NotificationSettings
          channelId={channelId}
          channelName={channelName}
          onClose={() => setShowNotificationSettings(false)}
        />
      )}

      {/* Huddle Panel */}
      {showHuddle && (
        <div className="fixed inset-y-0 right-0 z-40">
          <HuddlePanel
            channelId={channelId}
            channelName={channelName}
            onClose={() => setShowHuddle(false)}
          />
        </div>
      )}

      {/* Canvas Editor */}
      {showCanvas && (
        <CanvasEditor
          channelId={channelId}
          onClose={() => setShowCanvas(false)}
        />
      )}
    </div>
  );
}
