import { NextRequest, NextResponse } from 'next/server';
import { computePropertyMetrics } from '@/domain/services/propertyMetricsService';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const metrics = await computePropertyMetrics(id);
    return NextResponse.json(metrics);
  } catch (error: any) {
    console.error('[GET /api/properties/:id/metrics] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to compute property metrics' },
      { status: 500 }
    );
  }
}

