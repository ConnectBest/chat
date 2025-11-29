'use client';

import { Avatar } from '@/components/ui/Avatar';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: 'online' | 'away' | 'offline';
}

interface MentionAutocompleteProps {
  users: User[];
  searchQuery: string;
  onSelect: (user: User) => void;
  position: { top: number; left: number };
}

export function MentionAutocomplete({ users, searchQuery, onSelect, position }: MentionAutocompleteProps) {
  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 5);

  if (filteredUsers.length === 0) return null;

  return (
    <div
      className="absolute bg-dark-800 border border-white/20 rounded-lg shadow-lg overflow-hidden z-50"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        minWidth: '250px',
        maxHeight: '200px',
      }}
    >
      <div className="p-2 bg-white/5 border-b border-white/10">
        <span className="text-xs text-white/50">Mention someone</span>
      </div>
      <div className="max-h-48 overflow-y-auto scrollbar-thin">
        {filteredUsers.map(user => (
          <button
            key={user.id}
            onClick={() => onSelect(user)}
            className="w-full flex items-center gap-3 p-2 hover:bg-white/10 transition text-left"
          >
            <Avatar name={user.name} status={user.status} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-medium truncate">{user.name}</div>
              <div className="text-white/50 text-xs truncate">{user.email}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
