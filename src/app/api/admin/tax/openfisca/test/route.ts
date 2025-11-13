import { NextResponse } from 'next/server';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ test: 'ok', timestamp: Date.now() });
}

