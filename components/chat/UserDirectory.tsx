"use client";
import React, { useState, useEffect } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

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
    // Mock users - Static code Backend team please change it to dynamic
    const mockUsers: User[] = [
      { id: '1', name: 'Demo User', email: 'demo@test.com', status: 'online' as const },
      { id: '2', name: 'Alice Johnson', email: 'alice@test.com', status: 'online' as const },
      { id: '3', name: 'Bob Smith', email: 'bob@test.com', status: 'away' as const },
      { id: '4', name: 'Carol Williams', email: 'carol@test.com', status: 'offline' as const },
      { id: '5', name: 'David Brown', email: 'david@test.com', status: 'online' as const },
    ].filter(u => u.id !== currentUserId);
    
    setUsers(mockUsers);
    setLoading(false);
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
        <Input
          placeholder="Search users..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full"
        />

        <div className="max-h-96 overflow-y-auto space-y-2 scrollbar-thin">
          {loading ? (
            <div className="text-center py-8 text-white/50">Loading users...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-white/50">No users found</div>
          ) : (
            filteredUsers.map(user => (
              <button
                key={user.id}
                onClick={() => handleSelectUser(user)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 transition text-left"
              >
                <Avatar name={user.name} status={user.status} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate">{user.name}</div>
                  <div className="text-white/50 text-sm truncate">{user.email}</div>
                </div>
                <div className={`text-xs px-2 py-1 rounded ${
                  user.status === 'online' ? 'bg-green-500/20 text-green-300' :
                  user.status === 'away' ? 'bg-yellow-500/20 text-yellow-300' :
                  'bg-gray-500/20 text-gray-300'
                }`}>
                  {user.status}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-white/10">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>

        <p className="text-[10px] text-white/40 text-center">
          Static code Backend team please change it to dynamic
        </p>
      </div>
    </Modal>
  );
}
