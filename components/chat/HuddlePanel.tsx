"use client";
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';

interface HuddleParticipant {
  id: string;
  name: string;
  isMuted: boolean;
  isSpeaking: boolean;
}

interface HuddlePanelProps {
  channelId: string;
  channelName: string;
  onClose: () => void;
}

export function HuddlePanel({ channelId, channelName, onClose }: HuddlePanelProps) {
  const [isActive, setIsActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [participants, setParticipants] = useState<HuddleParticipant[]>([]);
  const [duration, setDuration] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);

  // Timer for huddle duration
  useEffect(() => {
    if (!isActive) return;
    
    const interval = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive]);

  // Mock: Start huddle
  function startHuddle() {
    setIsActive(true);
    setDuration(0);
    // Static code Backend team please change it to dynamic - POST /api/huddles/start
    // Simulate joining
    setTimeout(() => {
      setParticipants([
        { id: '1', name: 'You', isMuted: false, isSpeaking: false }
      ]);
    }, 500);
  }

  // Mock: Leave huddle
  function leaveHuddle() {
    if (confirm('Leave huddle?')) {
      setIsActive(false);
      setParticipants([]);
      setDuration(0);
      onClose();
      // Static code Backend team please change it to dynamic - POST /api/huddles/leave
    }
  }

  // Toggle mute
  function toggleMute() {
    setIsMuted(!isMuted);
    setParticipants(prev => 
      prev.map(p => p.id === '1' ? { ...p, isMuted: !isMuted } : p)
    );
    // Static code Backend team please change it to dynamic - POST /api/huddles/mute
  }

  // Toggle deafen (mute + stop hearing others)
  function toggleDeafen() {
    const newDeafened = !isDeafened;
    setIsDeafened(newDeafened);
    if (newDeafened) {
      setIsMuted(true);
      setParticipants(prev => 
        prev.map(p => p.id === '1' ? { ...p, isMuted: true } : p)
      );
    }
    // Static code Backend team please change it to dynamic - POST /api/huddles/deafen
  }

  // Format duration
  function formatDuration(seconds: number) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Minimized view
  if (isMinimized && isActive) {
    return (
      <div className="fixed bottom-4 right-4 bg-brand-600 text-white rounded-lg px-4 py-3 shadow-xl flex items-center gap-3 z-50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-sm font-medium">Huddle • {formatDuration(duration)}</span>
        </div>
        <div className="flex items-center gap-1">
          {participants.slice(0, 3).map(p => (
            <div key={p.id} className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs">
              {p.name[0]}
            </div>
          ))}
          {participants.length > 3 && (
            <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs">
              +{participants.length - 3}
            </div>
          )}
        </div>
        <button
          onClick={() => setIsMinimized(false)}
          className="hover:bg-white/10 rounded p-1 transition"
          title="Expand"
        >
          ⬆️
        </button>
      </div>
    );
  }

  return (
    <div className="border-l border-white/10 h-full flex flex-col w-80" style={{ background: 'linear-gradient(to bottom, #3d4b6d, #2f3a52)' }}>
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <span className="text-2xl">🎧</span>
            Huddle
          </h3>
          <div className="flex items-center gap-1">
            {isActive && (
              <button
                onClick={() => setIsMinimized(true)}
                className="text-white/70 hover:text-white p-1 rounded hover:bg-white/10 transition"
                title="Minimize"
              >
                ⬇️
              </button>
            )}
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white p-1 rounded hover:bg-white/10 transition"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>
        <p className="text-white/70 text-sm">
          {isActive ? `In ${channelName}` : `Start a huddle in ${channelName}`}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!isActive ? (
          // Start Huddle View
          <div className="space-y-4">
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🎙️</div>
              <h4 className="text-white font-medium mb-2">Start a huddle</h4>
              <p className="text-white/70 text-sm mb-6">
                Huddles are lightweight audio conversations. They're perfect for quick chats that don't need a scheduled meeting.
              </p>
              <Button onClick={startHuddle} className="w-full">
                🎧 Start Huddle
              </Button>
            </div>

            <div className="border-t border-white/10 pt-4">
              <h5 className="text-white/70 text-xs font-semibold uppercase mb-3">How huddles work</h5>
              <ul className="space-y-2 text-sm text-white/60">
                <li className="flex items-start gap-2">
                  <span>✓</span>
                  <span>Audio-only, lightweight calls</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>✓</span>
                  <span>Anyone in the channel can join</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>✓</span>
                  <span>No scheduling needed</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>✓</span>
                  <span>Perfect for casual conversations</span>
                </li>
              </ul>
            </div>
          </div>
        ) : (
          // Active Huddle View
          <div className="space-y-4">
            {/* Duration */}
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <div className="text-white/50 text-xs mb-1">Duration</div>
              <div className="text-white text-2xl font-mono">{formatDuration(duration)}</div>
            </div>

            {/* Participants */}
            <div>
              <h4 className="text-white/70 text-xs font-semibold uppercase mb-3">
                In this huddle ({participants.length})
              </h4>
              <div className="space-y-2">
                {participants.map(participant => (
                  <div key={participant.id} className="flex items-center gap-3 p-2 rounded hover:bg-white/5 transition">
                    <div className="relative">
                      <Avatar name={participant.name} size="sm" status="online" />
                      {participant.isSpeaking && (
                        <div className="absolute -inset-1 rounded-full border-2 border-green-400 animate-pulse" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-white text-sm font-medium">{participant.name}</div>
                    </div>
                    {participant.isMuted && (
                      <span className="text-red-400 text-sm">🔇</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Invite Link */}
            <div className="border-t border-white/10 pt-4">
              <button className="w-full text-brand-400 hover:text-brand-300 text-sm font-medium hover:bg-white/5 rounded p-2 transition">
                + Invite people to this huddle
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      {isActive && (
        <div className="p-4 border-t border-white/10 space-y-2">
          {/* Audio Controls */}
          <div className="flex gap-2">
            <button
              onClick={toggleMute}
              className={`flex-1 p-3 rounded-lg transition ${
                isMuted 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? '🔇' : '🎤'} {isMuted ? 'Unmuted' : 'Muted'}
            </button>
            <button
              onClick={toggleDeafen}
              className={`flex-1 p-3 rounded-lg transition ${
                isDeafened 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title={isDeafened ? 'Undeafen' : 'Deafen'}
            >
              {isDeafened ? '🔈' : '🔊'}
            </button>
          </div>

          {/* Leave Button */}
          <Button
            onClick={leaveHuddle}
            variant="secondary"
            className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/50"
          >
            Leave Huddle
          </Button>
        </div>
      )}
    </div>
  );
}
