import { NextRequest, NextResponse } from 'next/server';
import { computePropertyMetrics } from '@/domain/services/propertyMetricsService';

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

