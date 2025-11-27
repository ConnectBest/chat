'use client';

import { useState } from 'react';
import { Avatar } from './Avatar';

interface UserProfilePopoverProps {
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    status: 'online' | 'away' | 'busy' | 'inmeeting' | 'offline';
    avatar?: string;
    statusMessage?: string;
  };
  onClose: () => void;
}

const statusColors = {
  online: 'bg-green-500',
  away: 'bg-yellow-500',
  busy: 'bg-red-500',
  inmeeting: 'bg-purple-500',
  offline: 'bg-gray-500'
};

const statusLabels = {
  online: 'Available',
  away: 'Away',
  busy: 'Busy',
  inmeeting: 'In a meeting',
  offline: 'Offline'
};

export function UserProfilePopover({ user, onClose }: UserProfilePopoverProps) {
  return (
    <>
      {/* Popover Card */}
      <div className="relative z-50 border border-white/20 rounded-lg shadow-2xl w-80 overflow-hidden" style={{ background: 'linear-gradient(to bottom, #3d4b6d, #2f3a52)' }}>
        {/* Header with gradient background */}
        <div className="bg-gradient-to-br from-brand-600 to-brand-800 p-6 pb-16" />
        
        {/* Profile content */}
        <div className="px-6 pb-6 -mt-12">
          {/* Avatar */}
          <div className="relative inline-block">
            <Avatar name={user.name} status={user.status} size="xl" />
          </div>
          
          {/* User Info */}
          <div className="mt-3">
            <h3 className="text-xl font-semibold text-white">{user.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${statusColors[user.status]}`} />
              <span className="text-sm text-white/70">{statusLabels[user.status]}</span>
            </div>
          </div>

          {/* Status Message */}
          {user.statusMessage && (
            <div className="mt-3 p-2 bg-white/5 rounded border-l-2 border-brand-500">
              <p className="text-sm text-white/80 italic">"{user.statusMessage}"</p>
            </div>
          )}

          {/* Contact Details */}
          <div className="mt-4 space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-white/50 text-sm w-16">Email</span>
              <a href={`mailto:${user.email}`} className="text-brand-400 hover:text-brand-300 text-sm break-all">
                {user.email}
              </a>
            </div>
            
            {user.phone && (
              <div className="flex items-start gap-3">
                <span className="text-white/50 text-sm w-16">Phone</span>
                <a href={`tel:${user.phone}`} className="text-brand-400 hover:text-brand-300 text-sm">
                  {user.phone}
                </a>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-6">
            <button 
              onClick={() => {
                window.location.href = `/chat/dm/${user.id}`;
              }}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white py-2 px-4 rounded transition text-sm font-medium"
            >
              💬 Send Message
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
