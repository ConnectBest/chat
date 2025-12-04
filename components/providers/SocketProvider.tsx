"use client";
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5001';

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Only connect if we have a session and an access token
    if (status === 'authenticated' && session?.user && (session.user as any)?.accessToken) {
      const token = (session.user as any).accessToken;
      
      try {
        const s = io(SOCKET_URL, { 
          auth: { token },
          transports: ['websocket', 'polling'],
          autoConnect: true,
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionAttempts: 5
        });
        
        socketRef.current = s;
        
        s.on('connect', () => {
          console.log('Socket connected');
          setConnected(true);
        });
        
        s.on('disconnect', () => {
          console.log('Socket disconnected');
          setConnected(false);
        });
        
        s.on('connect_error', (error) => {
          // Silently handle connection errors - don't throw
          console.warn('Socket connection error (will retry):', error.message);
          setConnected(false);
        });
        
        return () => { 
          s.disconnect(); 
        };
      } catch (error) {
        console.warn('Failed to initialize socket:', error);
      }
    } else if (socketRef.current) {
      // Disconnect if session is lost
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnected(false);
    }
  }, [session, status]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}
