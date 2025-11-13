import { NextResponse } from 'next/server';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET() {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  return NextResponse.json({ test: 'ok', timestamp: Date.now() });
}

