import { NextResponse } from 'next/server';
import { getUserHeaders } from '@/lib/apiUtils';
import type { NextRequest } from 'next/server';

// Use internal backend URL for server-side API route communication
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function POST(request: NextRequest) {
  try {
    console.log('[Upload API] Uploading file');

    // Get authenticated headers with JWT token
    const authData = await getUserHeaders(request);

    if (!authData) {
      console.error('[Upload API] No authenticated session');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get the form data from the request
    const formData = await request.formData();

    // Create headers WITHOUT Content-Type for multipart/form-data
    // The browser will set the correct boundary
    const headers: Record<string, string> = {
      'Authorization': authData.headers['Authorization'],
      'X-User-ID': authData.headers['X-User-ID'],
      'X-User-Email': authData.headers['X-User-Email'],
      'X-User-Role': authData.headers['X-User-Role']
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
