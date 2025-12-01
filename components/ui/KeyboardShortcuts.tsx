'use client';

import { useEffect, useState } from 'react';

interface KeyboardShortcut {
  key: string;
  description: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
}

const shortcuts: KeyboardShortcut[] = [
  { key: 'K', description: 'Quick switcher', ctrl: true },
  { key: '/', description: 'Search messages', ctrl: true },
  { key: 'N', description: 'Compose new message', ctrl: true },
  { key: 'E', description: 'Edit last message', ctrl: true },
  { key: 'Enter', description: 'Send message', ctrl: true },
  { key: 'B', description: 'Bold text', ctrl: true },
  { key: 'I', description: 'Italic text', ctrl: true },
  { key: 'U', description: 'Strikethrough text', ctrl: true, shift: true },
  { key: '`', description: 'Code block', ctrl: true, shift: true },
  { key: 'Up', description: 'Edit last message', ctrl: false },
  { key: 'Escape', description: 'Close/cancel', ctrl: false },
  { key: 'T', description: 'Open threads', ctrl: true },
  { key: 'D', description: 'Toggle DMs', ctrl: true },
];

export function KeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    function handleKeyPress(e: KeyboardEvent) {
      // Show shortcuts modal
      if (e.ctrlKey && e.key === '?') {
        e.preventDefault();
        setIsOpen(true);
      }
      
      // Close with Escape
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isOpen]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-brand-500 text-white p-3 rounded-full shadow-lg hover:bg-brand-600 transition z-40"
        title="Keyboard shortcuts (Ctrl + ?)"
      >
        ⌨️
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-white/10 scrollbar-thin">
        <div className="sticky top-0 bg-dark-800 border-b border-white/10 p-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Keyboard Shortcuts</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-white/50 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shortcuts.map((shortcut, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded hover:bg-white/10 transition">
                <span className="text-white/90 text-sm">{shortcut.description}</span>
                <div className="flex items-center gap-1">
                  {shortcut.ctrl && (
                    <kbd className="px-2 py-1 bg-white/10 text-white/70 text-xs rounded border border-white/20">
                      Ctrl
                    </kbd>
                  )}
                  {shortcut.shift && (
                    <kbd className="px-2 py-1 bg-white/10 text-white/70 text-xs rounded border border-white/20">
                      Shift
                    </kbd>
                  )}
                  {shortcut.alt && (
                    <kbd className="px-2 py-1 bg-white/10 text-white/70 text-xs rounded border border-white/20">
                      Alt
                    </kbd>
                  )}
                  <kbd className="px-2 py-1 bg-white/10 text-white/70 text-xs rounded border border-white/20">
                    {shortcut.key}
                  </kbd>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-brand-500/10 rounded border border-brand-500/30">
            <p className="text-sm text-white/70 text-center">
              Press <kbd className="px-2 py-1 bg-white/10 text-white/70 text-xs rounded border border-white/20">Ctrl</kbd> + 
              <kbd className="px-2 py-1 bg-white/10 text-white/70 text-xs rounded border border-white/20 ml-1">?</kbd> anytime to view shortcuts
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
