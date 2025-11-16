import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { computePortfolioSummary } from '@/domain/services/propertyMetricsService';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const summary = await computePortfolioSummary(organizationId);
    return NextResponse.json(summary);
  } catch (error: any) {
    console.error('[GET /api/portfolio/summary] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to compute portfolio summary' },
      { status: 500 }
    );
  }
}

