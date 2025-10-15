import { checkMongoConnection } from '@/lib/mongodb';
import { NextResponse } from 'next/server';

export async function GET() {
  const result = await checkMongoConnection();

  if (result.connected) {
    return NextResponse.json({
      status: 'ok',
      mongodb: 'connected'
    }, { status: 200 });
  } else {
    return NextResponse.json({
      status: 'error',
      mongodb: 'disconnected',
      error: result.error
    }, { status: 500 });
  }
}
