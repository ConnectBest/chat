import { NextResponse } from 'next/server';

export async function GET() {
  const metrics = {
    activeConnections: Math.floor(Math.random() * 100) + 50,
    totalMessages: Math.floor(Math.random() * 10000) + 5000,
    averageLatency: Math.floor(Math.random() * 50) + 20,
    errorRate: Math.random() * 2,
    cpuUsage: Math.floor(Math.random() * 30) + 20,
    memoryUsage: Math.floor(Math.random() * 40) + 40,
    timestamp: new Date().toISOString()
  };

  return NextResponse.json(metrics, { status: 200 });
}
