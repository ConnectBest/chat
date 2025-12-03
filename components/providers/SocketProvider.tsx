"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
  onlineUsers: Record<string, "online">;
}

const SocketContext = createContext<SocketContextValue | undefined>(
  undefined
);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<
    Record<string, "online">
  >({});

  useEffect(() => {
    const userId = session?.user?.id as string | undefined;

    if (!userId) {
      if (socket) {
        socket.disconnect();
      }
      setSocket(null);
      setConnected(false);
      setOnlineUsers({});
      return;
    }

    const url =
      process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000";

    const s: Socket = io(url, {
      path: "/ws",
      auth: { userId },
      transports: ["websocket"],
    });

    setSocket(s);

    s.on("connect", () => {
      setConnected(true);
      // 保險：主動報到 presence
      s.emit("presence:online", { userId });
    });

    s.on("disconnect", () => {
      setConnected(false);
      setOnlineUsers({});
    });

    s.on("presence:state", (userIds: string[]) => {
      const map: Record<string, "online"> = {};
      for (const id of userIds) {
        map[id] = "online";
      }
      setOnlineUsers(map);
    });

    s.on(
      "presence:update",
      ({
        userId,
        status,
      }: {
        userId: string;
        status: "online" | "offline";
      }) => {
        setOnlineUsers((prev) => {
          const copy = { ...prev };
          if (status === "online") {
            copy[userId] = "online";
          } else {
            delete copy[userId];
          }
          return copy;
        });
      }
    );

    return () => {
      s.disconnect();
      setSocket(null);
      setConnected(false);
      setOnlineUsers({});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  return (
    <SocketContext.Provider value={{ socket, connected, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within SocketProvider");
  return ctx;
}