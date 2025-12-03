import { checkMongoConnection } from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { withTrace } from "@/lib/logger";

export async function GET(request: Request) {
  const traceId = request.headers.get("x-trace-id") ?? undefined;
  const log = withTrace(traceId);

  const startedAt = Date.now();

  // ==== Mongo 健康檢查 + latency ====
  const mongoStart = Date.now();
  const mongoResult = await checkMongoConnection();
  const mongoLatencyMs = Date.now() - mongoStart;

  // ==== Redis 健康檢查 + latency ====
  let redisStatus: "connected" | "disconnected" = "disconnected";
  let redisLatencyMs: number | null = null;
  let redisError: string | undefined;

  try {
    const redis = await getRedis();
    const redisStart = Date.now();
    const pong = await redis.ping();
    redisLatencyMs = Date.now() - redisStart;

    if (pong === "PONG") {
      redisStatus = "connected";
    } else {
      redisStatus = "disconnected";
      redisError = `Unexpected PING result: ${pong}`;
    }
  } catch (err) {
    redisStatus = "disconnected";
    redisError = (err as Error).message;
  }

  const totalLatencyMs = Date.now() - startedAt;

  // mock uptime（目前先隨機一個 30 天內的啟動時間）
  const startTime = Date.now() - Math.random() * 86400000 * 30;
  const uptimeDays = parseFloat(
    ((Date.now() - startTime) / 1000 / 60 / 60 / 24).toFixed(2)
  );

  const basePayload = {
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    uptimeDays,
    services: {
      mongodb: mongoResult.connected ? "connected" : "disconnected",
      redis: redisStatus,
      api: "operational",
    },
    metrics: {
      latencyMs: totalLatencyMs,
      mongoLatencyMs,
      redisLatencyMs,
    },
    traceId,
  };

  const allOk = mongoResult.connected && redisStatus === "connected";

  if (allOk) {
    const health = {
      status: "healthy" as const,
      uptime: 99.99,
      version: basePayload.version,
      timestamp: basePayload.timestamp,
    };

    const body = {
      // 給 OpsPage 用
      health,
      status: health.status,
      uptime: health.uptime,
      // 保留詳細 payload（services / metrics / traceId ...）
      ...basePayload,
    };

    log.info("Health check OK", body);
    return NextResponse.json(body, { status: 200 });
  } else {
    const health = {
      status: "degraded" as const,
      uptime: 98.5,
      version: basePayload.version,
      timestamp: basePayload.timestamp,
    };

    const body = {
      // 給 OpsPage 用
      health,
      status: health.status,
      uptime: health.uptime,
      // 保留詳細 payload
      ...basePayload,
      error:
        mongoResult.error ??
        redisError ??
        "One or more dependencies are degraded",
    };

    log.error("Health check degraded", body);
    return NextResponse.json(body, { status: 500 });
  }
}