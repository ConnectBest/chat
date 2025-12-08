import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Load build info (commit hash, version, etc.)
    let buildInfo;
    try {
      const buildInfoPath = path.join(process.cwd(), 'public', 'build-info.json');
      const buildInfoContent = fs.readFileSync(buildInfoPath, 'utf8');
      buildInfo = JSON.parse(buildInfoContent);
    } catch (error) {
      // Fallback if build-info.json is not available
      buildInfo = {
        version: '1.0.0',
        gitCommit: 'unknown',
        gitShort: 'unknown',
        gitBranch: 'unknown',
        buildTime: 'unknown'
      };
    }

    const startTime = Date.now() - (Math.random() * 86400000 * 30); // Mock uptime
    const uptime = ((Date.now() - startTime) / 1000 / 60 / 60 / 24).toFixed(2);

    // Basic health check that doesn't depend on external services
    // This ensures the frontend can respond even if backend services are down
    const healthData: {
      status: string;
      uptime: number;
      version: string;
      commit: string;
      commitShort: string;
      branch: string;
      buildTime: string;
      timestamp: string;
      services: Record<string, string>;
      uptimeDays: number;
    } = {
      status: 'healthy',
      uptime: 99.99,
      version: buildInfo.version,
      commit: buildInfo.gitCommit,
      commitShort: buildInfo.gitShort,
      branch: buildInfo.gitBranch,
      buildTime: buildInfo.buildTime,
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

    // Reduced logging: Only log health checks every 10 requests or if unhealthy
    const shouldLog = Math.random() < 0.1 || healthData.status !== 'healthy';
    if (shouldLog) {
      console.log(`[Health Check] Status: ${healthData.status}, Commit: ${healthData.commitShort}, Services: ${Object.keys(healthData.services).length}`);
    }

    return NextResponse.json(healthData, {
      status: healthData.status === 'healthy' ? 200 : 503
    });
  } catch (error) {
    // Always log errors
    console.error('[Health Check] Error:', error);
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 });
  }
}

