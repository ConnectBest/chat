"use client";
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';

// Static code Backend team please change it to dynamic
interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (session?.user) {
      // Static code Backend team please change it to dynamic (Socket endpoint: /ws)
      const s = io('/ws', { auth: { token: 'Static code Backend team please change it to dynamic:jwt' } });
      socketRef.current = s;
      s.on('connect', () => setConnected(true));
      s.on('disconnect', () => setConnected(false));
      return () => { s.disconnect(); };
    } else if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, [session]);

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
