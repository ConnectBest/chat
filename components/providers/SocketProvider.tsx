"use client";
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

<<<<<<< HEAD
=======
interface WebSocketMessage {
  type: string;
  channelId?: string;
  message?: string;
  userId?: string;
  userName?: string;
  timestamp?: string;
  [key: string]: any;
}

>>>>>>> 399e8d1b7b8b74bbff8cb0637d760c3feae65df8
interface SocketContextValue {
  socket: WebSocket | null;
  connected: boolean;
  sendMessage: (channelId: string, message: string) => void;
  onMessage: (callback: (data: WebSocketMessage) => void) => () => void;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5001';

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const messageCallbacksRef = useRef<Set<(data: WebSocketMessage) => void>>(new Set());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);

<<<<<<< HEAD
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
=======
  const connect = useCallback(() => {
    if (!session?.user) return;

    const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
    if (!wsUrl) {
      console.warn('NEXT_PUBLIC_WEBSOCKET_URL not configured, WebSocket disabled');
      return;
    }

    try {
      const userId = (session.user as any).id || 'anonymous';
      const userName = session.user.name || 'Anonymous';
      const url = `${wsUrl}?userId=${encodeURIComponent(userId)}&userName=${encodeURIComponent(userName)}&channelId=general`;

      const ws = new WebSocket(url);
      socketRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        reconnectAttemptsRef.current = 0;
      };

      ws.onclose = (event) => {
        setConnected(false);
        socketRef.current = null;

        // Auto-reconnect with exponential backoff
        if (session?.user && reconnectAttemptsRef.current < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('⚠️ WebSocket error:', error);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Notify all registered callbacks
          messageCallbacksRef.current.forEach(callback => callback(data));
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
>>>>>>> 399e8d1b7b8b74bbff8cb0637d760c3feae65df8
    }
  }, [session, status]);

  useEffect(() => {
    if (session?.user) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [session, connect]);

  const sendMessage = useCallback((channelId: string, message: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        action: 'sendMessage',
        channelId,
        message,
        userId: (session?.user as any)?.id,
        userName: session?.user?.name
      }));
    }
  }, [session]);

  const onMessage = useCallback((callback: (data: WebSocketMessage) => void) => {
    messageCallbacksRef.current.add(callback);
    return () => {
      messageCallbacksRef.current.delete(callback);
    };
  }, []);

  return (
    <SocketContext.Provider value={{
      socket: socketRef.current,
      connected,
      sendMessage,
      onMessage
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}
