import { checkMongoConnection } from '@/lib/mongodb';
import { NextResponse } from 'next/server';

export async function GET() {
  const result = await checkMongoConnection();
  const startTime = Date.now() - (Math.random() * 86400000 * 30); // Mock uptime
  const uptime = ((Date.now() - startTime) / 1000 / 60 / 60 / 24).toFixed(2);

  if (result.connected) {
    return NextResponse.json({
      status: 'healthy',
      uptime: 99.99,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      services: {
        mongodb: 'connected',
        api: 'operational'
      },
      uptimeDays: parseFloat(uptime)
    }, { status: 200 });
  } else {
    return NextResponse.json({
      status: 'degraded',
      uptime: 98.5,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      services: {
        mongodb: 'disconnected',
        api: 'operational'
      },
      error: result.error
    }, { status: 500 });
  }
}

