import { NextResponse } from 'next/server';
import type { AppVersionPayload } from '@/lib/pwa/appVersionTypes';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Version de déploiement lue côté serveur (non cachée par CDN) pour comparaison avec le bundle client.
 */
export function GET() {
  const body: AppVersionPayload = {
    commit: (process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'unknown').trim(),
    buildTime: (process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString()).trim(),
    deployEnv: (process.env.VERCEL_ENV || process.env.NODE_ENV || 'development').trim(),
  };

  return NextResponse.json(body, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
      'CDN-Cache-Control': 'no-store',
      'Vercel-CDN-Cache-Control': 'no-store',
    },
  });
}
