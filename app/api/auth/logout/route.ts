import { NextResponse } from 'next/server';
export async function POST() {
  // Stateless mock; client should just drop token.
  return NextResponse.json({ ok: true }, { status: 200 });
}
