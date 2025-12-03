import type { Server } from "socket.io";

let io: Server | null = null;

/**
 * 在 server.ts 啟動時設定 socket.io 實例
 */
export function setIO(instance: Server) {
  io = instance;
}

/**
 * 在 API route / 其他地方取得 socket.io 實例
 * 拿不到就回 null，不再 throw error
 */
export function getIO(): Server | null {
  return io;
}