import React from 'react';
import { Button } from './Button';

interface ModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function Modal({ title, open, onClose, children, actions }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-lg bg-brand-800/70 backdrop-blur-lg p-6 border border-white/20 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <Button variant="ghost" aria-label="Close" onClick={onClose}>✕</Button>
        </div>
        <div className="text-sm text-white/90 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-thin">
          {children}
        </div>
        {actions && <div className="mt-6 flex justify-end gap-2">{actions}</div>}
      </div>
    </div>
  );
}
