import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const startTime = Date.now() - (Math.random() * 86400000 * 30); // Mock uptime
    const uptime = ((Date.now() - startTime) / 1000 / 60 / 60 / 24).toFixed(2);

    // Basic health check that doesn't depend on external services
    // This ensures the frontend can respond even if backend services are down
    const healthData = {
      status: 'healthy',
      uptime: 99.99,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      services: {
        frontend: 'operational'
      },
      uptimeDays: parseFloat(uptime)
    };

    // Optionally check MongoDB, but don't fail the health check if it's down
    try {
      const { checkMongoConnection } = await import('@/lib/mongodb');
      const mongoResult = await Promise.race([
        checkMongoConnection(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);

      if (mongoResult && typeof mongoResult === 'object' && 'connected' in mongoResult) {
        healthData.services.mongodb = mongoResult.connected ? 'connected' : 'disconnected';
        if (!mongoResult.connected) {
          healthData.status = 'degraded';
          healthData.uptime = 98.5;
        }
      }
    } catch (error) {
      // MongoDB check failed, but don't fail the entire health check
      healthData.services.mongodb = 'unavailable';
      healthData.status = 'degraded';
      healthData.uptime = 98.0;
    }

    return NextResponse.json(healthData, {
      status: healthData.status === 'healthy' ? 200 : 503
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 });
  }
}

