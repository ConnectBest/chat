"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CallControls } from './CallControls';
import { NotificationSettings } from './NotificationSettings';
import { HuddlePanel } from './HuddlePanel';
import { CanvasEditor } from './CanvasEditor';

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
    // Mock users - Static code Backend team please change it to dynamic
    const mockUsers: User[] = [
      { id: '1', name: 'Demo User', email: 'demo@test.com', phone: '+1234567890', status: 'online' },
      { id: '2', name: 'Alice Johnson', email: 'alice@test.com', phone: '+1234567891', status: 'online' },
      { id: '3', name: 'Bob Smith', email: 'bob@test.com', phone: '+1234567892', status: 'away' },
      { id: '4', name: 'Carol Williams', email: 'carol@test.com', phone: '+1234567893', status: 'offline' },
      { id: '5', name: 'David Brown', email: 'david@test.com', phone: '+1234567894', status: 'online' },
    ];
    setAllUsers(mockUsers);
    
    // Mock current members - Static code Backend team please change it to dynamic
    setChannelMembers([mockUsers[0], mockUsers[1]]);
  }, [channelId]);

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
    setChannelMembers(prev => [...prev, user]);
    setSearchQuery('');
    setSearchResults([]);
    // Static code Backend team please change it to dynamic - POST /api/channels/:id/members
    console.log('Added member:', user);
  }

  function handleRemoveMember(userId: string) {
    setChannelMembers(prev => prev.filter(m => m.id !== userId));
    // Static code Backend team please change it to dynamic - DELETE /api/channels/:id/members/:userId
    console.log('Removed member:', userId);
  }

  function handleRenameChannel() {
    if (!newChannelName.trim() || newChannelName === channelName) {
      setShowRenameChannel(false);
      return;
    }
    
    // Static code Backend team please change it to dynamic - PUT /api/channels/:id
    console.log('Renamed channel to:', newChannelName);
    onUpdateChannel?.(newChannelName, channelMembers.map(m => m.id));
    setShowRenameChannel(false);
    setIsMenuOpen(false);
  }

  function toggleLock() {
    setIsLocked(!isLocked);
    // Static code Backend team please change it to dynamic - PUT /api/channels/:id/lock
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
                            <Avatar name={user.name} status={user.status} size="sm" />
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
                      <Avatar name={member.name} status={member.status} size="sm" />
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
                Static code Backend team please change it to dynamic
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
