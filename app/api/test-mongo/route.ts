import { NextResponse } from 'next/server';
import { checkMongoConnection, getMongoClient } from '@/lib/mongodb';

export async function GET() {
  try {
    console.log('🔍 Testing MongoDB connection...');
    console.log('📋 Environment check:');
    console.log('  - MONGODB_URI set:', !!process.env.MONGODB_URI);
    console.log('  - MONGODB_DB_NAME set:', !!process.env.MONGODB_DB_NAME);
    console.log('  - MONGODB_DB_NAME value:', process.env.MONGODB_DB_NAME);

    // Test basic connection
    const connectionTest = await checkMongoConnection();
    console.log('🔗 Connection test result:', connectionTest);

    if (!connectionTest.connected) {
      return NextResponse.json({
        success: false,
        error: connectionTest.error,
        details: 'Failed to connect to MongoDB'
      }, { status: 500 });
    }

    // Test database and collection access
    const client = await getMongoClient();
    const db = client.db(process.env.MONGODB_DB_NAME || 'chatapp');

    console.log('📚 Testing database access...');

    // Test users collection access
    const usersCollection = db.collection('users');
    const userCount = await usersCollection.countDocuments();

    console.log('👥 Users collection - document count:', userCount);

    // Test a simple query
    const sampleUser = await usersCollection.findOne({}, {
      projection: { email: 1, _id: 1, created_at: 1 }
    });

    console.log('🔍 Sample user found:', !!sampleUser);
    if (sampleUser) {
      console.log('   - ID:', sampleUser._id);
      console.log('   - Email:', sampleUser.email);
    }

    return NextResponse.json({
      success: true,
      connection: 'OK',
      database: process.env.MONGODB_DB_NAME || 'chatapp',
      collections: {
        users: {
          count: userCount,
          accessible: true,
          sampleUser: sampleUser ? {
            id: sampleUser._id,
            email: sampleUser.email,
            created: sampleUser.created_at
          } : null
        }
      },
      environment: {
        MONGODB_URI_set: !!process.env.MONGODB_URI,
        MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || 'chatapp',
        NODE_ENV: process.env.NODE_ENV
      }
    });

  } catch (error) {
    console.error('❌ MongoDB test error:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      environment: {
        MONGODB_URI_set: !!process.env.MONGODB_URI,
        MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || 'chatapp'
      }
    }, { status: 500 });
  }
}