import React from 'react';
import clsx from 'clsx';

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'away' | 'busy' | 'inmeeting';
}

export function Avatar({ src, name='', size='md', status='offline' }: AvatarProps) {
  const initials = name.split(' ').map(p => p[0]).join('').slice(0,2).toUpperCase();
  return (
    <div className={clsx('relative flex items-center justify-center rounded-full bg-white/20 text-white font-semibold',
      size === 'sm' && 'h-8 w-8 text-xs',
      size === 'md' && 'h-12 w-12 text-sm',
      size === 'lg' && 'h-16 w-16 text-lg',
      size === 'xl' && 'h-24 w-24 text-2xl'
    )} aria-label={name}>
      {src ? <img src={src} alt={name} className="h-full w-full rounded-full object-cover" /> : initials}
      <span className={clsx('absolute bottom-0 right-0 rounded-full ring-2 ring-brand-800',
        size === 'sm' && 'h-2.5 w-2.5',
        size === 'md' && 'h-3 w-3',
        size === 'lg' && 'h-4 w-4',
        size === 'xl' && 'h-5 w-5',
        status==='online' && 'bg-green-400',
        status==='away' && 'bg-yellow-400',
        status==='busy' && 'bg-red-400',
        status==='inmeeting' && 'bg-purple-400',
        status==='offline' && 'bg-gray-400'
      )} />
    </div>
  );
}
