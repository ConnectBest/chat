"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';

interface CallControlsProps {
  channelId?: string;
  isDM?: boolean;
  dmUserId?: string;
  dmUserName?: string;
}

type CallType = 'audio' | 'video' | null;

export function CallControls({ channelId, isDM, dmUserId, dmUserName }: CallControlsProps) {
  const [isInCall, setIsInCall] = useState(false);
  const [callType, setCallType] = useState<CallType>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const screenShareRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Call duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isInCall) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isInCall]);

  // Format call duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start audio call
  async function startAudioCall() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      mediaStreamRef.current = stream;
      
      setIsInCall(true);
      setCallType('audio');
      setCallDuration(0);
      
      console.log('Audio call started with:', dmUserId || channelId);
    } catch (error) {
      console.error('Error starting audio call:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  }

  // Start video call
  async function startVideoCall() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      mediaStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      setIsInCall(true);
      setCallType('video');
      setCallDuration(0);
      
      console.log('Video call started with:', dmUserId || channelId);
    } catch (error) {
      console.error('Error starting video call:', error);
      alert('Could not access camera/microphone. Please check permissions.');
    }
  }

  // Toggle mute
  function toggleMute() {
    if (mediaStreamRef.current) {
      const audioTracks = mediaStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  }

  // Toggle video
  function toggleVideo() {
    if (mediaStreamRef.current && callType === 'video') {
      const videoTracks = mediaStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  }

  // Start screen sharing
  async function startScreenShare() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      screenStreamRef.current = stream;
      
      if (screenShareRef.current) {
        screenShareRef.current.srcObject = stream;
      }
      
      setIsScreenSharing(true);
      
      // Stop screen sharing when user stops sharing
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
      
      console.log('Screen sharing started');
    } catch (error) {
      console.error('Error starting screen share:', error);
      alert('Could not start screen sharing. Please check permissions.');
    }
  }

  // Stop screen sharing
  function stopScreenShare() {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
      setIsScreenSharing(false);
      
      if (screenShareRef.current) {
        screenShareRef.current.srcObject = null;
      }
    }
  }

  // End call
  function endCall() {
    // Stop all media streams
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    
    setIsInCall(false);
    setCallType(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    setCallDuration(0);
    
    console.log('Call ended');
  }

  return (
    <>
      {/* Call Control Buttons (when not in call) */}
      {!isInCall && (
        <div className="flex gap-2">
          <button
            onClick={startAudioCall}
            className="p-2 hover:bg-white/10 rounded-lg transition text-white/70 hover:text-white"
            aria-label="Start audio call"
            title="Audio Call"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </button>
          <button
            onClick={startVideoCall}
            className="p-2 hover:bg-white/10 rounded-lg transition text-white/70 hover:text-white"
            aria-label="Start video call"
            title="Video Call"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </button>
        </div>
      )}

      {/* Active Call UI */}
      {isInCall && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
          {/* Call Header */}
          <div className="bg-brand-900/50 backdrop-blur-lg border-b border-white/10 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar name={dmUserName || channelId || 'User'} size="md" />
              <div>
                <div className="text-white font-semibold">
                  {isDM ? dmUserName : `# ${channelId}`}
                </div>
                <div className="text-white/60 text-sm flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span>{formatDuration(callDuration)}</span>
                </div>
              </div>
            </div>
            <div className="text-white/60 text-sm">
              {callType === 'audio' ? '🎙️ Audio Call' : '📹 Video Call'}
            </div>
          </div>

          {/* Video Container */}
          <div className="flex-1 relative bg-gray-900">
            {callType === 'video' && (
              <>
                {/* Remote Video (Main) */}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                
                {/* Local Video (Picture-in-Picture) */}
                <div className="absolute top-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden border-2 border-white/20 shadow-xl">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {isVideoOff && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                      <Avatar name={dmUserName || 'You'} size="lg" />
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Audio Call Display */}
            {callType === 'audio' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Avatar name={dmUserName || channelId || 'User'} size="xl" />
                  <div className="text-white text-2xl font-semibold mt-4">
                    {dmUserName || channelId}
                  </div>
                  <div className="text-white/60 mt-2">{formatDuration(callDuration)}</div>
                  <div className="text-white/40 text-sm mt-4">
                    {isMuted ? '🔇 Microphone muted' : '🎙️ Call in progress'}
                  </div>
                </div>
              </div>
            )}

            {/* Screen Share Display */}
            {isScreenSharing && (
              <div className="absolute bottom-20 left-4 w-96 h-60 bg-gray-800 rounded-lg overflow-hidden border-2 border-brand-500 shadow-xl">
                <div className="bg-brand-600 px-3 py-1 text-white text-xs font-medium">
                  🖥️ Screen Sharing
                </div>
                <video
                  ref={screenShareRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                />
              </div>
            )}
          </div>

          {/* Call Controls */}
          <div className="bg-brand-900/80 backdrop-blur-lg border-t border-white/10 p-6">
            <div className="max-w-2xl mx-auto flex items-center justify-center gap-4">
              {/* Mute/Unmute */}
              <button
                onClick={toggleMute}
                className={`p-4 rounded-full transition ${
                  isMuted 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-white/10 hover:bg-white/20'
                }`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2">
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                )}
              </button>

              {/* Video On/Off (only for video calls) */}
              {callType === 'video' && (
                <button
                  onClick={toggleVideo}
                  className={`p-4 rounded-full transition ${
                    isVideoOff 
                      ? 'bg-red-500 hover:bg-red-600' 
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                  title={isVideoOff ? 'Turn video on' : 'Turn video off'}
                >
                  {isVideoOff ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2">
                      <path d="m16 16 2.54-2.54a2 2 0 0 1 3.46 1.41V19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10l4.54 4.54" />
                      <line x1="2" y1="2" x2="22" y2="22" />
                    </svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <polygon points="23 7 16 12 23 17 23 7" />
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                  )}
                </button>
              )}

              {/* Screen Share */}
              <button
                onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                className={`p-4 rounded-full transition ${
                  isScreenSharing 
                    ? 'bg-brand-500 hover:bg-brand-600' 
                    : 'bg-white/10 hover:bg-white/20'
                }`}
                title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                  {isScreenSharing && (
                    <circle cx="12" cy="10" r="3" fill="white" />
                  )}
                </svg>
              </button>

              {/* End Call */}
              <button
                onClick={endCall}
                className="p-4 rounded-full bg-red-500 hover:bg-red-600 transition"
                title="End call"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </button>
            </div>

            <div className="text-center mt-4 text-white/40 text-xs">
            </div>
          </div>
        </div>
      )}
    </>
  );
}
