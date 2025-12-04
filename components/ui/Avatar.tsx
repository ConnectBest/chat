import React from 'react';
import clsx from 'clsx';
import { getStaticUrl } from '@/lib/apiConfig';

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'away' | 'busy' | 'inmeeting';
}

export function Avatar({ src, name='', size='md', status='offline' }: AvatarProps) {
  // Fallback for null/undefined names
  const displayName = name || 'User';
  const initials = displayName.split(' ').map(p => p[0]).join('').slice(0,2).toUpperCase();
  const [imageError, setImageError] = React.useState(false);
  
  // Reset error state when src changes
  React.useEffect(() => {
    setImageError(false);
  }, [src]);
  
  return (
    <div className={clsx('relative flex items-center justify-center rounded-full bg-white/20 text-white font-semibold',
      size === 'sm' && 'h-8 w-8 text-xs',
      size === 'md' && 'h-12 w-12 text-sm',
      size === 'lg' && 'h-16 w-16 text-lg',
      size === 'xl' && 'h-24 w-24 text-2xl'
    )} aria-label={displayName}>
      {src && !imageError ? (
        <img 
          src={src.startsWith('http') ? src : getStaticUrl(src)} 
          alt={displayName} 
          className="h-full w-full rounded-full object-cover" 
          onError={() => {
            // Fallback to initials if image fails to load
            setImageError(true);
          }}
        />
      ) : initials}
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
