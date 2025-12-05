"use client";
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface WebSocketMessage {
  type: string;
  channelId?: string;
  message?: string;
  userId?: string;
  userName?: string;
  timestamp?: string;
  [key: string]: any;
}

interface SocketContextValue {
  socket: WebSocket | null;
  connected: boolean;
  sendMessage: (channelId: string, message: string) => void;
  onMessage: (callback: (data: WebSocketMessage) => void) => () => void;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5001';
const MAX_RECONNECT_ATTEMPTS = 3;
const INITIAL_RECONNECT_DELAY = 1000;

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const messageCallbacksRef = useRef<Set<(data: WebSocketMessage) => void>>(new Set());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);
  const shouldConnectRef = useRef(true);

  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up WebSocket connection...');

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }

    if (socketRef.current) {
      const ws = socketRef.current;
      socketRef.current = null;

      // Remove event listeners to prevent callbacks after cleanup
      ws.onopen = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;

      if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Component cleanup');
      }
    }

    setConnected(false);
    isConnectingRef.current = false;
  }, []);

  const connect = useCallback(() => {
    // Don't connect if we shouldn't or if already connecting/connected
    if (!shouldConnectRef.current || !session?.user || status !== 'authenticated') {
      console.log('🚫 Skipping WebSocket connection:', {
        shouldConnect: shouldConnectRef.current,
        hasUser: !!session?.user,
        status
      });
      return;
    }

    // Prevent multiple concurrent connection attempts
    if (isConnectingRef.current || (socketRef.current && socketRef.current.readyState === WebSocket.CONNECTING)) {
      console.log('🔄 WebSocket already connecting, skipping...');
      return;
    }

    // Don't reconnect if we've reached max attempts
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.log('❌ Max reconnection attempts reached, giving up');
      return;
    }

    const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
    if (!wsUrl) {
      console.warn('⚠️ NEXT_PUBLIC_WEBSOCKET_URL not configured, WebSocket disabled');
      return;
    }

    try {
      // Clean up any existing connection first
      if (socketRef.current) {
        cleanup();
      }

      const userId = (session.user as any).id || 'anonymous';
      const userName = session.user.name || 'Anonymous';
      const url = `${wsUrl}?userId=${encodeURIComponent(userId)}&userName=${encodeURIComponent(userName)}&channelId=general`;

      console.log('🔌 Connecting to WebSocket:', {
        url: wsUrl,
        userId,
        userName,
        attempt: reconnectAttemptsRef.current + 1
      });

      isConnectingRef.current = true;
      const ws = new WebSocket(url);
      socketRef.current = ws;

      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          console.log('⏰ WebSocket connection timeout');
          ws.close();
        }
      }, 10000); // 10 second timeout

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('✅ WebSocket connected successfully');
        setConnected(true);
        isConnectingRef.current = false;
        reconnectAttemptsRef.current = 0;
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log('🔌 WebSocket closed:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });

        setConnected(false);
        isConnectingRef.current = false;

        // Only attempt reconnect if:
        // 1. We should still be connected (component not unmounted)
        // 2. We haven't reached max attempts
        // 3. The close wasn't clean (not user-initiated)
        // 4. We have a valid session
        if (shouldConnectRef.current &&
            reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS &&
            !event.wasClean &&
            session?.user) {

          const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current);
          console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error('⚠️ WebSocket error:', error);
        isConnectingRef.current = false;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 WebSocket message received:', data);
          // Notify all registered callbacks
          messageCallbacksRef.current.forEach(callback => callback(data));
        } catch (error) {
          console.error('❌ Failed to parse WebSocket message:', error, event.data);
        }
      };

    } catch (error) {
      console.error('❌ Failed to create WebSocket:', error);
      isConnectingRef.current = false;
    }
  }, [session?.user, status, cleanup]);

  // Connect when session is ready
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      console.log('👤 Session authenticated, initializing WebSocket...');
      shouldConnectRef.current = true;
      reconnectAttemptsRef.current = 0;
      connect();
    } else if (status === 'unauthenticated') {
      console.log('🚫 Session unauthenticated, cleaning up WebSocket...');
      shouldConnectRef.current = false;
      cleanup();
    }

    // Cleanup on unmount
    return () => {
      shouldConnectRef.current = false;
      cleanup();
    };
  }, [status, session?.user?.id, connect, cleanup]);

  const sendMessage = useCallback((channelId: string, message: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN && session?.user) {
      const payload = {
        action: 'sendMessage',
        channelId,
        message,
        userId: (session.user as any)?.id,
        userName: session.user?.name
      };

      console.log('📤 Sending WebSocket message:', payload);
      socketRef.current.send(JSON.stringify(payload));
    } else {
      console.warn('⚠️ Cannot send message: WebSocket not connected or no session');
    }
  }, [session?.user]);

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
