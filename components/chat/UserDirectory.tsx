"use client";
import React, { useState, useEffect } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { getApiUrl } from '@/lib/apiConfig';

interface User {
  id: string;
  name: string;
  email: string;
  status: 'online' | 'away' | 'offline';
  avatar?: string;
}

interface UserDirectoryProps {
  open: boolean;
  onClose: () => void;
  onSelectUser: (user: User) => void;
  currentUserId: string;
}

export function UserDirectory({ open, onClose, onSelectUser, currentUserId }: UserDirectoryProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setUsers([]);
        setLoading(false);
        return;
      }

      const response = await fetch(getApiUrl('users'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Filter out current user if needed
        const allUsers = data.users || [];
        setUsers(allUsers.filter((u: User) => u.id !== currentUserId));
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function handleSelectUser(user: User) {
    onSelectUser(user);
    onClose();
    setSearchQuery('');
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Start a Conversation"
    >
      <div className="space-y-4">
        <div className="relative">
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium text-white/50 uppercase tracking-wider px-2 py-1">
            {loading ? 'Loading...' : `${filteredUsers.length} ${filteredUsers.length === 1 ? 'person' : 'people'}`}
          </div>
          
          <div className="max-h-[400px] overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-white/40">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mb-3"></div>
                <p className="text-sm">Loading users...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-white/40">
                <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-sm font-medium">No users found</p>
                <p className="text-xs mt-1">Try a different search term</p>
              </div>
            ) : (
              filteredUsers.map(user => (
                <button
                  key={user.id}
                  onClick={() => handleSelectUser(user)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-white/10 active:bg-white/15 transition-all duration-150 text-left group"
                >
                  <div className="flex-shrink-0">
                    <Avatar src={user.avatar} name={user.name} status={user.status} size="md" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold text-base group-hover:text-white transition-colors">{user.name}</div>
                    <div className="text-white/50 text-sm group-hover:text-white/60 transition-colors">{user.email}</div>
                  </div>
                  <div className={`text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap flex items-center gap-1.5 flex-shrink-0 ${
                    user.status === 'online' ? 'bg-green-500/20 text-green-300' :
                    user.status === 'away' ? 'bg-yellow-500/20 text-yellow-300' :
                    'bg-gray-500/20 text-gray-300'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      user.status === 'online' ? 'bg-green-400' :
                      user.status === 'away' ? 'bg-yellow-400' :
                      'bg-gray-400'
                    }`}></span>
                    {user.status}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
