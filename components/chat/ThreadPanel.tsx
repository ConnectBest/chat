"use client";
import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface Message {
  id: string;
  content: string;
  userId: string;
  createdAt: string;
  replies?: Message[];
}

interface ThreadPanelProps {
  message: Message;
  onClose: () => void;
}

export function ThreadPanel({ message, onClose }: ThreadPanelProps) {
  const [replies, setReplies] = useState<Message[]>(message.replies || []);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleReply() {
    if (!content.trim()) return;
    setLoading(true);
    // Static code Backend team please change it to dynamic (POST /api/messages/:id/replies)
    const reply: Message = {
      id: (Date.now()).toString(),
      content: content.trim(),
      userId: '1',
      createdAt: new Date().toISOString()
    };
    setReplies(prev => [...prev, reply]);
    setContent('');
    setLoading(false);
  }

  return (
    <div className="w-96 border-l border-white/10 flex flex-col" style={{ background: 'linear-gradient(to bottom, #3d4b6d, #2f3a52)' }}>
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h3 className="font-semibold text-white">Thread</h3>
        <Button variant="ghost" onClick={onClose} aria-label="Close thread">✕</Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        <div className="rounded bg-white/10 px-3 py-2 text-sm">
          <div className="text-white/70 text-xs mb-1">
            {new Date(message.createdAt).toLocaleString()} • user {message.userId}
          </div>
          <div className="text-white font-medium">{message.content}</div>
        </div>

        <div className="text-xs text-white/50 font-semibold">{replies.length} replies</div>

        {replies.map(r => (
          <div key={r.id} className="rounded bg-white/5 px-3 py-2 text-sm ml-4">
            <div className="text-white/70 text-xs mb-1">
              {new Date(r.createdAt).toLocaleString()} • user {r.userId}
            </div>
            <div className="text-white">{r.content}</div>
          </div>
        ))}
      </div>

      <form onSubmit={e => { e.preventDefault(); handleReply(); }} className="p-3 border-t border-white/10 flex gap-2">
        <Input
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Reply to thread..."
          aria-label="Thread reply"
        />
        <Button type="submit" loading={loading}>Reply</Button>
      </form>
    </div>
  );
}
