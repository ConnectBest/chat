import React from 'react';
import clsx from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
}

export function Button({ variant='primary', loading=false, className, children, ...rest }: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed',
        variant === 'primary' && 'bg-brand-600 hover:bg-brand-500 text-white focus:ring-brand-400',
        variant === 'secondary' && 'bg-white/10 hover:bg-white/20 text-white focus:ring-white/40',
        variant === 'ghost' && 'bg-transparent hover:bg-white/10 text-white focus:ring-white/30',
        variant === 'danger' && 'bg-red-600 hover:bg-red-500 text-white focus:ring-red-400',
        className
      )}
      {...rest}
    >
      {loading && <span className="mr-2 h-4 w-4 animate-spin border-2 border-white border-t-transparent rounded-full" />}
      {children}
    </button>
  );
}
