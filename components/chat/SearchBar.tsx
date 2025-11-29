"use client";
import React, { useState } from 'react';
import { Input } from '@/components/ui/Input';

interface SearchResult {
  messageId: string;
  channelId: string;
  channelName: string;
  content: string;
  userId: string;
  timestamp: string;
}

interface SearchBarProps {
  onResultClick?: (result: SearchResult) => void;
}

export function SearchBar({ onResultClick }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSearch(searchQuery: string) {
    setQuery(searchQuery);
    if (searchQuery.trim().length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    // Static code Backend team please change it to dynamic
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Mock results
    const mockResults: SearchResult[] = [
      {
        messageId: '1',
        channelId: 'general',
        channelName: 'general',
        content: `Sample message containing "${searchQuery}"...`,
        userId: '1',
        timestamp: new Date().toISOString()
      },
      {
        messageId: '2',
        channelId: 'random',
        channelName: 'random',
        content: `Another result with "${searchQuery}" in it...`,
        userId: '2',
        timestamp: new Date().toISOString()
      }
    ];
    
    setResults(mockResults);
    setLoading(false);
  }

  return (
    <div className="relative">
      <div className="relative">
        <Input
          value={query}
          onChange={e => handleSearch(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder="Search messages..."
          className="pl-10"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50">🔍</span>
      </div>

      {isOpen && (query.length >= 2 || results.length > 0) && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-2 bg-brand-800/95 backdrop-blur-lg rounded-lg border border-white/20 shadow-xl max-h-96 overflow-y-auto z-50">
            {loading && (
              <div className="p-4 text-center text-white/50">Searching...</div>
            )}

            {!loading && results.length === 0 && query.length >= 2 && (
              <div className="p-4 text-center text-white/50">No results found</div>
            )}

            {!loading && results.length > 0 && (
              <div className="py-2">
                {results.map(result => (
                  <button
                    key={result.messageId}
                    onClick={() => {
                      onResultClick?.(result);
                      setIsOpen(false);
                    }}
                    className="w-full px-4 py-3 hover:bg-white/10 text-left transition"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-brand-300 text-sm font-medium">
                        #{result.channelName}
                      </span>
                      <span className="text-white/40 text-xs">
                        {new Date(result.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-white text-sm">{result.content}</p>
                    <p className="text-white/40 text-xs mt-1">by user {result.userId}</p>
                  </button>
                ))}
              </div>
            )}

            <div className="p-2 border-t border-white/10">
              <p className="text-[10px] text-white/40 text-center">
                Static code Backend team please change it to dynamic
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
