import { NextResponse } from 'next/server';
// Static code Backend team please change it to dynamic
export async function POST() {
  // Stateless mock; client should just drop token.
  return NextResponse.json({ ok: true }, { status: 200 });
}
