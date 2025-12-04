"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert?: (text: string) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function AIChatPanel({ isOpen, onClose, onInsert }: AIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedResponse, setSelectedResponse] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsProcessing(true);

    try {
      // TODO: AI team to integrate their API here
      // Example API call:
      // const response = await fetch('/api/ai/chat', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ 
      //     message: userMessage.content,
      //     history: messages 
      //   })
      // });
      // const data = await response.json();

      // Simulated response - Replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I received your message: "${userMessage.content}"\n\nThis is a placeholder response. The AI team will integrate the actual processing logic here.\n\nI can help you with:\n• Summarizing conversations\n• Drafting messages\n• Finding information\n• Answering questions`,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('AI processing error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInsertMessage = (content: string) => {
    if (onInsert) {
      onInsert(content);
      setSelectedResponse(null);
    }
  };

  const handleClearChat = () => {
    if (confirm('Clear all chat history?')) {
      setMessages([]);
    }
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Side Panel */}
      <div
        className={`fixed top-0 right-0 h-full bg-[#1a1d29] border-l border-white/10 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width: '420px', maxWidth: '90vw' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-purple-900/20 to-blue-900/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center shadow-lg">
              <span className="text-2xl">✨</span>
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg">AI Assistant</h3>
              <p className="text-white/60 text-xs">Ask me anything</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={handleClearChat}
                className="text-white/60 hover:text-white transition text-xs px-2 py-1 hover:bg-white/5 rounded"
                title="Clear chat"
              >
                Clear
              </button>
            )}
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition text-xl p-1 hover:bg-white/10 rounded"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ height: 'calc(100vh - 180px)' }}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-2xl flex items-center justify-center mb-4">
                <span className="text-4xl">💬</span>
              </div>
              <h4 className="text-white font-semibold mb-2">Start a conversation</h4>
              <p className="text-white/60 text-sm mb-4">
                I can help you with tasks, answer questions, and assist with your work.
              </p>
              <div className="text-left w-full max-w-xs space-y-2">
                <div className="text-white/40 text-xs font-semibold mb-2">Try asking:</div>
                <button
                  onClick={() => setInputValue("Summarize today's conversations")}
                  className="w-full text-left px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-white/80 transition"
                >
                  📊 Summarize today's conversations
                </button>
                <button
                  onClick={() => setInputValue("Help me draft a professional message")}
                  className="w-full text-left px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-white/80 transition"
                >
                  ✍️ Help me draft a message
                </button>
                <button
                  onClick={() => setInputValue("What topics were discussed this week?")}
                  className="w-full text-left px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-white/80 transition"
                >
                  🔍 What was discussed this week?
                </button>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-4 py-2.5 ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                        : 'bg-white/5 text-white border border-white/10'
                    }`}
                  >
                    <div className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </div>
                    {message.role === 'assistant' && onInsert && (
                      <div className="mt-2 pt-2 border-t border-white/10">
                        <button
                          onClick={() => handleInsertMessage(message.content)}
                          className="text-xs text-purple-400 hover:text-purple-300 transition flex items-center gap-1"
                        >
                          <span>⤴</span> Insert into message
                        </button>
                      </div>
                    )}
                    <div className="text-[10px] opacity-50 mt-1">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              {isProcessing && (
                <div className="flex justify-start">
                  <div className="bg-white/5 rounded-lg px-4 py-3 border border-white/10">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-white/70 text-sm">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-[#1a1d29] border-t border-white/10">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Ask me anything..."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none"
                rows={2}
                disabled={isProcessing}
              />
              <div className="absolute bottom-2 right-2 text-[10px] text-white/30">
                Enter to send
              </div>
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isProcessing}
              className="self-end px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all shadow-lg disabled:shadow-none"
              title="Send message"
            >
              {isProcessing ? (
                <span className="inline-block animate-spin">⏳</span>
              ) : (
                <span>➤</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
