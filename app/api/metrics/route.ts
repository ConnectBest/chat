import { NextResponse } from "next/server";
import { getDb, usersCollection, messagesCollection } from "@/lib/database";
import { getRedis } from "@/lib/redis";
import { withTrace } from "@/lib/logger";
import os from "os";

export const dynamic = "force-dynamic";

/**
 * GET /api/metrics
 *
 * FRONTEND_DOCS 期望的簡單格式：
 * {
 *   activeConnections,
 *   totalMessages,
 *   averageLatency,
 *   errorRate,
 *   cpuUsage,
 *   memoryUsage,
 * }
 *
 * 目前我們同時回傳：
 * - 平坦欄位（給 OpsPage 直接用）
 * - metrics: {...}（結構化物件）
 * - raw: {...}（更底層細節）
 */
export async function GET(request: Request) {
  const traceId = request.headers.get("x-trace-id") ?? undefined;
  const log = withTrace(traceId);

  const startedAt = Date.now();

  try {
    const db = await getDb();
    const redis = await getRedis();

    // Mongo ping + latency
    const mongoStart = Date.now();
    await db.command({ ping: 1 });
    const mongoLatency = Date.now() - mongoStart;

    // Redis ping + latency
    const redisStart = Date.now();
    const redisPing = await redis.ping();
    const redisLatency = Date.now() - redisStart;

    // 粗略統計（用 estimatedDocumentCount 避免太重）
    const [usersCol, messagesCol, channelsCol] = await Promise.all([
      usersCollection(),
      messagesCollection(),
      db.collection("channels"),
    ]);

    const [userCount, messageCount, channelCount] = await Promise.all([
      usersCol.estimatedDocumentCount(),
      messagesCol.estimatedDocumentCount(),
      channelsCol.estimatedDocumentCount(),
    ]);

    // Redis memory / connections
    let redisUsedMemory: number | null = null;
    let activeConnections: number | null = null;
    try {
      const memoryInfo = await redis.info("memory");
      const memLine = memoryInfo
        .split("\n")
        .find((l) => l.startsWith("used_memory:"));
      if (memLine) {
        const parts = memLine.split(":");
        redisUsedMemory = Number(parts[1]);
      }

      const clientsInfo = await redis.info("clients");
      const connLine = clientsInfo
        .split("\n")
        .find((l) => l.startsWith("connected_clients:"));
      if (connLine) {
        const parts = connLine.split(":");
        activeConnections = Number(parts[1]);
      }
    } catch {
      // 解析失敗就保持 null，不影響主流程
      redisUsedMemory = null;
      activeConnections = null;
    }

    const totalLatency = Date.now() - startedAt;

    // 🔹 原始 metrics（保留給 debug／其他用途）
    const raw = {
      status: "ok" as const,
      latencyMs: totalLatency,
      mongo: {
        latencyMs: mongoLatency,
      },
      redis: {
        latencyMs: redisLatency,
        ping: redisPing,
        usedMemoryBytes: redisUsedMemory,
      },
      counts: {
        users: userCount,
        channels: channelCount,
        messages: messageCount,
      },
      timestamp: new Date().toISOString(),
    };

    // 🔹 OpsPage 需要的 summary 結構
    const cpuLoad = os.loadavg?.()[0] ?? 0.5;
    const cpuUsage = Math.min(95, Math.max(5, Math.round(cpuLoad * 20)));

    const rss = process.memoryUsage().rss;
    const totalMem = os.totalmem();
    const memoryUsage = Math.min(
      99,
      Math.max(1, Math.round((rss / totalMem) * 100))
    );

    const metrics = {
      activeConnections: activeConnections ?? userCount, // 沒讀到就用 user 數粗估
      totalMessages: messageCount,
      averageLatency: totalLatency, // ms
      errorRate: 0.1, // 目前沒有真實錯誤率，先放一個很小的值
      cpuUsage,
      memoryUsage,
    };

    // 🟢 對齊 FRONTEND_DOCS：平坦欄位 + metrics + raw
    const body = {
      // 平坦欄位：OpsPage 可以直接用 data.activeConnections 等
      activeConnections: metrics.activeConnections,
      totalMessages: metrics.totalMessages,
      averageLatency: metrics.averageLatency,
      errorRate: metrics.errorRate,
      cpuUsage: metrics.cpuUsage,
      memoryUsage: metrics.memoryUsage,

      // 結構化 metrics 物件：data.metrics.xxx 也能用
      metrics,

      // 詳細原始資料
      raw,
    };

    log.info("Admin metrics fetched", body);

    return NextResponse.json(body, { status: 200 });
  } catch (err) {
    const totalLatency = Date.now() - startedAt;

    const errorBody = {
      status: "error",
      latencyMs: totalLatency,
      error: (err as Error).message,
    };

    log.error("Admin metrics FAILED", errorBody);

    return NextResponse.json(errorBody, { status: 500 });
  }
}