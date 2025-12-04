"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';

interface AIAssistantProps {
  onClose: () => void;
  onInsert: (text: string) => void;
}

export function AIAssistant({ onClose, onInsert }: AIAssistantProps) {
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  async function handleSubmit() {
    if (!prompt.trim()) return;

    const userPrompt = prompt.trim();
    setIsProcessing(true);

    try {
      // const result = await fetch('/api/ai/process', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ prompt: userPrompt })
      // });
      // const data = await result.json();
      // setResponse(data.response);
      
      // Placeholder - AI team will integrate their API here
      setResponse(`AI response will appear here for prompt: "${userPrompt}"\n\n(AI team will integrate their processing logic)`);
    } catch (error) {
      console.error('AI processing error:', error);
      setResponse('Error processing request. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }

  function insertToMessage() {
    if (response) {
      onInsert(response);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="w-full max-w-2xl rounded-lg shadow-2xl overflow-hidden"
        style={{ background: 'linear-gradient(to bottom, #3d4b6d, #2f3a52)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-2xl">✨</span>
            </div>
            <div>
              <h3 className="text-white font-semibold">AI Assistant</h3>
              <p className="text-white/70 text-xs">Enter your prompt</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Prompt Input */}
          <div>
            <label className="block text-white/70 text-sm mb-2">Your Prompt</label>
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Enter your prompt here..."
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-brand-500 resize-none"
              rows={4}
              disabled={isProcessing}
            />
            <p className="text-white/40 text-xs mt-1">Press Enter to send, Shift+Enter for new line</p>
          </div>

          {/* Response Display */}
          {(response || isProcessing) && (
            <div>
              <label className="block text-white/70 text-sm mb-2">AI Response</label>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 min-h-[120px]">
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-white/70 text-sm">Processing...</span>
                  </div>
                ) : (
                  <div className="text-white text-sm whitespace-pre-wrap">{response}</div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSubmit}
              disabled={!prompt.trim() || isProcessing}
              className="flex-1"
            >
              {isProcessing ? 'Processing...' : '✨ Send to AI'}
            </Button>
            {response && !isProcessing && (
              <Button
                onClick={insertToMessage}
                className="flex-1"
              >
                ✓ Insert to Message
              </Button>
            )}
            <Button
              onClick={onClose}
              variant="secondary"
            >
              Cancel
            </Button>
          </div>

          {/* Info */}
          <p className="text-white/40 text-xs text-center">
            AI team will integrate their processing logic here
          </p>
        </div>
      </div>
    </div>
  );
}
