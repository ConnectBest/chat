"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';

interface ClipsRecorderProps {
  channelId: string;
  onClose: () => void;
  onSend: (clipUrl: string, clipType: 'video' | 'audio', duration: number) => void;
}

export function ClipsRecorder({ channelId, onClose, onSend }: ClipsRecorderProps) {
  const [recordingType, setRecordingType] = useState<'video' | 'audio' | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [recordedClips, setRecordedClips] = useState<Array<{id: string; type: 'video' | 'audio'; url: string; duration: number; createdAt: string}>>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Timer for recording duration
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording, isPaused]);

  async function startRecording(type: 'video' | 'audio') {
    try {
      const constraints = type === 'video' 
        ? { video: true, audio: true }
        : { audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (type === 'video' && videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { 
          type: type === 'video' ? 'video/webm' : 'audio/webm' 
        });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        
        // Save to recorded clips
        const newClip = {
          id: Date.now().toString(),
          type,
          url,
          duration,
          createdAt: new Date().toISOString()
        };
        setRecordedClips(prev => [newClip, ...prev]);
      };

      mediaRecorder.start();
      setRecordingType(type);
      setIsRecording(true);
      setDuration(0);
    } catch (error) {
      console.error('Error accessing media devices:', error);
      alert('Could not access camera/microphone. Please check permissions.');
    }
  }

  function pauseRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  }

  function resumeRecording() {
    if (mediaRecorderRef.current && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  }

  function deleteClip(clipId: string) {
    setRecordedClips(prev => prev.filter(c => c.id !== clipId));
    if (previewUrl && recordedClips.find(c => c.id === clipId)?.url === previewUrl) {
      setPreviewUrl(null);
    }
  }

  function sendClip(clip: typeof recordedClips[0]) {
    onSend(clip.url, clip.type, clip.duration);
    onClose();
  }

  function formatDuration(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="w-full max-w-4xl h-[90vh] flex rounded-lg shadow-2xl overflow-hidden"
        style={{ background: 'linear-gradient(to bottom, #3d4b6d, #2f3a52)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Main Recording Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <span className="text-2xl">🎬</span>
              Record a Clip
            </h3>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white transition"
              title="Close"
            >
              ✕
            </button>
          </div>

          {/* Recording View */}
          <div className="flex-1 flex items-center justify-center p-6">
            {!isRecording && !previewUrl ? (
              <div className="text-center space-y-6">
                <div className="text-6xl mb-4">🎥</div>
                <h4 className="text-white text-xl font-medium mb-2">Choose Recording Type</h4>
                <p className="text-white/70 mb-6">Record a quick video or audio clip to share with your team</p>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => startRecording('video')}
                    className="px-6 py-4 bg-brand-500 hover:bg-brand-600 rounded-lg transition flex flex-col items-center gap-2 min-w-[150px]"
                  >
                    <span className="text-3xl">📹</span>
                    <span className="text-white font-medium">Video Clip</span>
                  </button>
                  <button
                    onClick={() => startRecording('audio')}
                    className="px-6 py-4 bg-brand-500 hover:bg-brand-600 rounded-lg transition flex flex-col items-center gap-2 min-w-[150px]"
                  >
                    <span className="text-3xl">🎙️</span>
                    <span className="text-white font-medium">Audio Clip</span>
                  </button>
                </div>
                <div className="mt-8 text-white/50 text-sm">
                  <p>💡 Tips:</p>
                  <ul className="mt-2 space-y-1">
                    <li>• Keep it short and focused (30s - 3min)</li>
                    <li>• Good lighting and quiet environment help</li>
                    <li>• You can pause and resume recording</li>
                  </ul>
                </div>
              </div>
            ) : isRecording ? (
              <div className="w-full max-w-3xl">
                {recordingType === 'video' ? (
                  <div className="relative">
                    <video
                      ref={videoRef}
                      className="w-full rounded-lg bg-black"
                      autoPlay
                      muted
                    />
                    <div className="absolute top-4 left-4 bg-red-500 px-3 py-1 rounded-full flex items-center gap-2">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      <span className="text-white text-sm font-medium">REC {formatDuration(duration)}</span>
                    </div>
                    {isPaused && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="text-white text-2xl">⏸️ Paused</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white/5 rounded-lg p-12 text-center">
                    <div className="text-6xl mb-4">🎙️</div>
                    <div className="text-white text-2xl font-medium mb-2">Recording Audio...</div>
                    <div className="text-white/70 text-lg mb-6">{formatDuration(duration)}</div>
                    {/* Audio waveform visualization */}
                    <div className="flex items-center justify-center gap-1 h-16">
                      {[...Array(20)].map((_, i) => (
                        <div
                          key={i}
                          className={`w-2 bg-brand-500 rounded-full transition-all ${isPaused ? 'h-4' : ''}`}
                          style={{ 
                            height: isPaused ? '16px' : `${Math.random() * 48 + 16}px`,
                            animation: isPaused ? 'none' : `pulse ${Math.random() * 0.5 + 0.3}s infinite`
                          }}
                        />
                      ))}
                    </div>
                    {isPaused && (
                      <div className="text-white/50 text-sm mt-4">⏸️ Paused</div>
                    )}
                  </div>
                )}
              </div>
            ) : previewUrl ? (
              <div className="w-full max-w-3xl">
                {recordingType === 'video' ? (
                  <video
                    src={previewUrl}
                    className="w-full rounded-lg bg-black"
                    controls
                  />
                ) : (
                  <div className="bg-white/5 rounded-lg p-12 text-center">
                    <div className="text-6xl mb-4">🎵</div>
                    <div className="text-white text-xl font-medium mb-4">Audio Clip Ready</div>
                    <audio src={previewUrl} controls className="w-full" />
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Controls */}
          <div className="p-6 border-t border-white/10">
            {isRecording ? (
              <div className="flex gap-3 justify-center">
                {isPaused ? (
                  <Button onClick={resumeRecording} className="px-8">
                    ▶️ Resume
                  </Button>
                ) : (
                  <Button onClick={pauseRecording} variant="secondary" className="px-8">
                    ⏸️ Pause
                  </Button>
                )}
                <Button onClick={stopRecording} className="px-8 bg-red-500 hover:bg-red-600">
                  ⏹️ Stop & Review
                </Button>
              </div>
            ) : previewUrl ? (
              <div className="flex gap-3 justify-center">
                <Button onClick={() => { setPreviewUrl(null); setRecordingType(null); }}>
                  🔄 Record Again
                </Button>
                <Button onClick={() => {
                  const clip = recordedClips[0];
                  if (clip) sendClip(clip);
                }} className="px-8">
                  ✓ Send Clip
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Sidebar - Recent Clips */}
        <div className="w-80 border-l border-white/10 flex flex-col">
          <div className="p-4 border-b border-white/10">
            <h4 className="text-white font-semibold text-sm">Recent Clips</h4>
          </div>
          <div className="flex-1 overflow-y-auto">
            {recordedClips.length === 0 ? (
              <div className="p-4 text-white/50 text-sm text-center">
                No clips yet. Record your first clip!
              </div>
            ) : (
              <div className="p-2 space-y-2">
                {recordedClips.map(clip => (
                  <div key={clip.id} className="bg-white/5 rounded-lg p-3 hover:bg-white/10 transition">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{clip.type === 'video' ? '📹' : '🎙️'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium">
                          {clip.type === 'video' ? 'Video' : 'Audio'} Clip
                        </div>
                        <div className="text-white/50 text-xs">
                          {formatDuration(clip.duration)} • {new Date(clip.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPreviewUrl(clip.url)}
                        className="flex-1 px-2 py-1 bg-brand-500/20 hover:bg-brand-500/30 rounded text-white text-xs transition"
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => sendClip(clip)}
                        className="flex-1 px-2 py-1 bg-brand-500 hover:bg-brand-600 rounded text-white text-xs transition"
                      >
                        Send
                      </button>
                      <button
                        onClick={() => deleteClip(clip.id)}
                        className="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-red-400 text-xs transition"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
