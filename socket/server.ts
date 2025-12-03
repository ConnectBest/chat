import { createServer } from "http";
import { Server } from "socket.io";
import { setIO } from "../lib/socket-server";

const httpServer = createServer();

const io = new Server(httpServer, {
  path: "/ws", // 要跟前端 SocketProvider 的 path 一樣
  cors: {
    origin: "http://localhost:3000",
    credentials: true,
  },
});

// 把 io 寫進共用 module，讓 API route 可以使用（同一個 process 時才會用到）
setIO(io);

// 簡單 in-memory presence（開發環境用，之後可換 Redis）
const onlineUsers = new Set<string>();

io.on("connection", (socket) => {
  const handshakeUserId = socket.handshake.auth?.userId as
    | string
    | undefined;

  let currentUserId: string | null = handshakeUserId ?? null;

  console.log("✅ socket connected:", socket.id, "user:", currentUserId);

  // 有 userId 的話，一連線就視為 online
  if (currentUserId) {
    onlineUsers.add(currentUserId);
    // 把目前整個 online 狀態給新來的 client
    socket.emit("presence:state", Array.from(onlineUsers));
    // 通知其他人：這個 user 上線
    socket.broadcast.emit("presence:update", {
      userId: currentUserId,
      status: "online" as const,
    });
  } else {
    socket.emit("presence:state", Array.from(onlineUsers));
  }

  /* ==========
   *  Presence: 主動報到（保險）
   * ========== */

  socket.on("presence:online", ({ userId }: { userId: string }) => {
    currentUserId = userId;
    onlineUsers.add(userId);
    socket.emit("presence:state", Array.from(onlineUsers));
    socket.broadcast.emit("presence:update", {
      userId,
      status: "online" as const,
    });
  });

  /* ==========
   *  加入 / 離開 channel room
   * ========== */

  socket.on("chat:join", (channelId: string) => {
    const roomId = `channel:${channelId}`;
    socket.join(roomId);
    console.log(`socket ${socket.id} joined ${roomId}`);
  });

  socket.on("chat:leave", (channelId: string) => {
    const roomId = `channel:${channelId}`;
    socket.leave(roomId);
    console.log(`socket ${socket.id} left ${roomId}`);
  });

  socket.on("chat:message", (dto: any) => {
  if (!dto || !dto.channelId) return;

  const roomId = `channel:${dto.channelId}`;
  console.log("[chat:message] relay to room", roomId, "from", socket.id);

  // 自己已經有這則訊息，所以只轉發給 other clients
  socket.to(roomId).emit("chat:message", dto);
});

  /* ==========
   *  Typing indicator（帶 userId + userName）
   * ========== */

  socket.on(
    "typing:start",
    ({
      channelId,
      userId,
      userName,
    }: {
      channelId: string;
      userId?: string;
      userName?: string;
    }) => {
      const roomId = `channel:${channelId}`;
      const effectiveUserId =
        userId ?? (socket.handshake.auth?.userId as string | undefined);

      console.log(
        "[typing] start",
        channelId,
        effectiveUserId,
        userName
      );

      socket.to(roomId).emit("typing:update", {
        channelId,
        userId: effectiveUserId,
        userName,
        typing: true,
      });
    }
  );

  socket.on(
    "typing:stop",
    ({
      channelId,
      userId,
      userName,
    }: {
      channelId: string;
      userId?: string;
      userName?: string;
    }) => {
      const roomId = `channel:${channelId}`;
      const effectiveUserId =
        userId ?? (socket.handshake.auth?.userId as string | undefined);

      console.log(
        "[typing] stop",
        channelId,
        effectiveUserId,
        userName
      );

      socket.to(roomId).emit("typing:update", {
        channelId,
        userId: effectiveUserId,
        userName,
        typing: false,
      });
    }
  );

  /* ==========
   *  Chat message relay
   * ========== */

  socket.on("chat:message", (dto: any) => {
    if (!dto || !dto.channelId) {
      console.warn("[chat:message] missing channelId in payload", dto);
      return;
    }

    const roomId = `channel:${dto.channelId}`;
    console.log("[chat:message] relay to room", roomId, "from", socket.id);

    // 自己已經在前端 setMessages 了，所以這裡用 to(...) 不包含自己
    socket.to(roomId).emit("chat:message", dto);
  });

  socket.on("disconnect", (reason) => {
    console.log("❌ socket disconnected:", socket.id, reason);

    if (currentUserId) {
      onlineUsers.delete(currentUserId);
      socket.broadcast.emit("presence:update", {
        userId: currentUserId,
        status: "offline" as const,
      });
    }
  });
});

const PORT = 4000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Socket server listening on http://localhost:${PORT}/ws`);
});