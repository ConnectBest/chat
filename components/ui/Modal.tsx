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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-[800px] max-w-[90vw] ml-80 rounded-2xl bg-gradient-to-br from-brand-700/95 to-brand-800/95 backdrop-blur-xl border border-white/20 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white hover:bg-white/10 rounded-lg p-2 transition-all duration-200"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="px-6 py-4">
          {children}
        </div>
        {actions && <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">{actions}</div>}
      </div>
    </div>
  );
}
