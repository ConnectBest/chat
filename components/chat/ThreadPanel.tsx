"use client";
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface Message {
  id: string;
  content: string;
  userId?: string;
  user_id?: string;
  createdAt?: string;
  created_at?: string;
  user?: {
    id: string;
    name: string;
    avatar?: string;
  };
  replies?: Message[];
}

interface ThreadPanelProps {
  message: Message;
  onClose: () => void;
}

export function ThreadPanel({ message, onClose }: ThreadPanelProps) {
  const [replies, setReplies] = useState<Message[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch thread replies when component mounts
  useEffect(() => {
    fetchReplies();
  }, [message.id]);

  async function fetchReplies() {
    try {
      const response = await fetch(`/api/chat/messages/${message.id}/replies`);

      if (response.ok) {
        const data = await response.json();
        setReplies(data.replies || []);
      }
    } catch (error) {
      console.error('Failed to fetch thread replies:', error);
    }
  }

  async function handleReply() {
    if (!content.trim()) return;
    setLoading(true);
    
    try {
      const response = await fetch(`/api/chat/messages/${message.id}/replies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: content.trim() })
      });

      if (!response.ok) {
        throw new Error('Failed to post reply');
      }

      const { reply } = await response.json();
      setReplies(prev => [...prev, reply]);
      setContent('');
    } catch (error) {
      console.error('Failed to post reply:', error);
      alert('Failed to post reply. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const messageUser = message.user || { name: 'Unknown User' };
  const messageCreatedAt = message.createdAt || message.created_at || new Date().toISOString();

  return (
    <div className="w-96 border-l border-white/10 flex flex-col" style={{ background: 'linear-gradient(to bottom, #3d4b6d, #2f3a52)' }}>
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h3 className="font-semibold text-white">Thread</h3>
        <Button variant="ghost" onClick={onClose} aria-label="Close thread">✕</Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        <div className="rounded bg-white/10 px-3 py-2 text-sm">
          <div className="text-white/70 text-xs mb-1">
            {new Date(messageCreatedAt).toLocaleString()} • {messageUser.name}
          </div>
          <div className="text-white font-medium">{message.content}</div>
        </div>

        <div className="text-xs text-white/50 font-semibold">{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</div>

        {replies.map(r => {
          const replyUser = r.user || { name: 'Unknown User' };
          const replyCreatedAt = r.createdAt || r.created_at || new Date().toISOString();
          
          return (
            <div key={r.id} className="rounded bg-white/5 px-3 py-2 text-sm ml-4">
              <div className="text-white/70 text-xs mb-1">
                {new Date(replyCreatedAt).toLocaleString()} • {replyUser.name}
              </div>
              <div className="text-white">{r.content}</div>
            </div>
          );
        })}
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
