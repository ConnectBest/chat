import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import type { NextRequest } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function POST(request: NextRequest) {
  try {
    console.log('[Upload API] Uploading file');

    // Get current session to verify authentication
    const session = await auth(request as any, {} as any);

    if (!session?.user) {
      console.error('[Upload API] No authenticated session');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get the form data from the request
    const formData = await request.formData();

    // Create headers with user info for Flask backend
    // Note: Don't set Content-Type for multipart/form-data, let fetch handle it
    const headers: Record<string, string> = {
      'X-User-ID': (session.user as any).id,
      'X-User-Email': session.user.email || '',
      'X-User-Role': (session.user as any).role || 'user'
    };

    const response = await fetch(`${BACKEND_URL}/api/upload/message-file`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      console.error('[Upload API] Upload failed:', response.status);
      const errorData = await response.json().catch(() => ({ error: 'Failed to upload file' }));
      return NextResponse.json(
        errorData,
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[Upload API] Successfully uploaded file');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Upload API] Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
