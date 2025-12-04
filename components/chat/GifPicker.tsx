'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}

// Mock trending GIFs - in production, integrate with Giphy or Tenor API
const TRENDING_GIFS = [
  { id: '1', url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif', title: 'Happy Dance' },
  { id: '2', url: 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif', title: 'Thumbs Up' },
  { id: '3', url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif', title: 'Excited' },
  { id: '4', url: 'https://media.giphy.com/media/XreQmk7ETCak0/giphy.gif', title: 'Celebration' },
  { id: '5', url: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif', title: 'Mind Blown' },
  { id: '6', url: 'https://media.giphy.com/media/3o6Zt6KHxJTbXCnSvu/giphy.gif', title: 'Laughing' },
  { id: '7', url: 'https://media.giphy.com/media/10UeedrT5MIfPG/giphy.gif', title: 'Clapping' },
  { id: '8', url: 'https://media.giphy.com/media/26AHONQ79FdWZhAI0/giphy.gif', title: 'Yes' },
];

export function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [gifs, setGifs] = useState(TRENDING_GIFS);

  function handleSearch(query: string) {
    setSearchQuery(query);
    if (!query.trim()) {
      setGifs(TRENDING_GIFS);
      return;
    }
    // For now, filter trending GIFs
    const filtered = TRENDING_GIFS.filter(gif => 
      gif.title.toLowerCase().includes(query.toLowerCase())
    );
    setGifs(filtered.length > 0 ? filtered : TRENDING_GIFS);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-lg max-w-2xl w-full border border-white/10">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Select a GIF</h3>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-4">
          <Input
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search GIFs..."
            className="mb-4"
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-96 overflow-y-auto scrollbar-thin">
            {gifs.map(gif => (
              <button
                key={gif.id}
                onClick={() => {
                  onSelect(gif.url);
                  onClose();
                }}
                className="relative aspect-square rounded overflow-hidden hover:ring-2 hover:ring-brand-500 transition group"
              >
                <img
                  src={gif.url}
                  alt={gif.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-end p-2">
                  <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition">
                    {gif.title}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {gifs.length === 0 && (
            <div className="text-center py-8 text-white/50">
              No GIFs found. Try a different search.
            </div>
          )}
        </div>

        <div className="p-3 border-t border-white/10 bg-white/5">
          <p className="text-xs text-white/40 text-center">
          </p>
        </div>
      </div>
    </div>
  );
}
