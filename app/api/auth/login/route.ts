import { NextResponse } from 'next/server';
import { authenticate } from '@/lib/mockAuthStore';

// Static code Backend team please change it to dynamic
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json({ error: 'email and password required' }, { status: 400 });
  }
  const user = authenticate(email, password);
  if (!user) {
    return NextResponse.json({ error: 'invalid credentials' }, { status: 401 });
  }
  const token = Buffer.from(user.id).toString('base64');
  return NextResponse.json({ user, token }, { status: 200 });
}
