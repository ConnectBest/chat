import { NextResponse } from 'next/server';
import { getUser } from '@/lib/mockAuthStore';

// Static code Backend team please change it to dynamic
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (!auth) return NextResponse.json({ user: null }, { status: 200 });
  const token = auth.replace('Bearer ', '');
  try {
    const id = Buffer.from(token, 'base64').toString('utf8');
    const user = getUser(id) || null;
    return NextResponse.json({ user }, { status: 200 });
  } catch {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
