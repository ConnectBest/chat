import React from 'react';
import clsx from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={clsx('w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/50 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300', className)}
      {...rest}
    />
  );
});
