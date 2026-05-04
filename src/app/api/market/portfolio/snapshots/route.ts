/* eslint-disable @typescript-eslint/naming-convention -- Route handlers Next.js App Router */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';

export const dynamic = 'force-dynamic';

function isAuthError(error: unknown): boolean {
  return error instanceof Error && error.message === 'Non authentifié';
}

const snapshotSchema = z.object({
  id: z.string().min(1),
  capturedAt: z.string().datetime(),
  totalMarketValue: z.number().finite(),
  totalRemainingCostBasis: z.number().finite(),
  totalUnrealizedPnL: z.number().finite(),
  totalRealizedPnL: z.number().finite(),
  totalDividendsNet: z.number().finite(),
  grossPerformanceEuro: z.number().finite(),
  netPerformanceAfterTaxEuro: z.number().finite(),
  surplusInflationEuro: z.number().finite(),
  valuationIncomplete: z.boolean(),
  createdAt: z.string().datetime().optional(),
});

function toApi(row: {
  id: string;
  organizationId: string;
  capturedAt: Date;
  totalMarketValue: number;
  totalRemainingCostBasis: number;
  totalUnrealizedPnL: number;
  totalRealizedPnL: number;
  totalDividendsNet: number;
  grossPerformanceEuro: number;
  netPerformanceAfterTaxEuro: number;
  surplusInflationEuro: number;
  valuationIncomplete: boolean;
  createdAt: Date;
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    capturedAt: row.capturedAt.toISOString(),
    totalMarketValue: row.totalMarketValue,
    totalRemainingCostBasis: row.totalRemainingCostBasis,
    totalUnrealizedPnL: row.totalUnrealizedPnL,
    totalRealizedPnL: row.totalRealizedPnL,
    totalDividendsNet: row.totalDividendsNet,
    grossPerformanceEuro: row.grossPerformanceEuro,
    netPerformanceAfterTaxEuro: row.netPerformanceAfterTaxEuro,
    surplusInflationEuro: row.surplusInflationEuro,
    valuationIncomplete: row.valuationIncomplete,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const limitRaw = request.nextUrl.searchParams.get('limit');
    const limit = limitRaw ? Math.max(1, Math.min(20_000, Number(limitRaw))) : 5000;
    const rows = await prisma.portfolioSnapshot.findMany({
      where: { organizationId: user.organizationId },
      orderBy: [{ capturedAt: 'asc' }, { createdAt: 'asc' }],
      take: Number.isFinite(limit) ? limit : 5000,
    });
    return NextResponse.json({ success: true, data: rows.map(toApi) });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('[api/market/portfolio/snapshots GET]', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération des snapshots' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const raw = await request.json();
    const parsed = snapshotSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });
    }
    const payload = parsed.data;
    const row = await prisma.portfolioSnapshot.upsert({
      where: { organizationId_id: { organizationId: user.organizationId, id: payload.id } },
      update: {
        capturedAt: new Date(payload.capturedAt),
        totalMarketValue: payload.totalMarketValue,
        totalRemainingCostBasis: payload.totalRemainingCostBasis,
        totalUnrealizedPnL: payload.totalUnrealizedPnL,
        totalRealizedPnL: payload.totalRealizedPnL,
        totalDividendsNet: payload.totalDividendsNet,
        grossPerformanceEuro: payload.grossPerformanceEuro,
        netPerformanceAfterTaxEuro: payload.netPerformanceAfterTaxEuro,
        surplusInflationEuro: payload.surplusInflationEuro,
        valuationIncomplete: payload.valuationIncomplete,
        ...(payload.createdAt ? { createdAt: new Date(payload.createdAt) } : {}),
      },
      create: {
        id: payload.id,
        organizationId: user.organizationId,
        capturedAt: new Date(payload.capturedAt),
        totalMarketValue: payload.totalMarketValue,
        totalRemainingCostBasis: payload.totalRemainingCostBasis,
        totalUnrealizedPnL: payload.totalUnrealizedPnL,
        totalRealizedPnL: payload.totalRealizedPnL,
        totalDividendsNet: payload.totalDividendsNet,
        grossPerformanceEuro: payload.grossPerformanceEuro,
        netPerformanceAfterTaxEuro: payload.netPerformanceAfterTaxEuro,
        surplusInflationEuro: payload.surplusInflationEuro,
        valuationIncomplete: payload.valuationIncomplete,
        ...(payload.createdAt ? { createdAt: new Date(payload.createdAt) } : {}),
      },
    });
    return NextResponse.json({ success: true, data: toApi(row) }, { status: 201 });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('[api/market/portfolio/snapshots POST]', error);
    return NextResponse.json({ error: 'Erreur lors de l’enregistrement du snapshot' }, { status: 500 });
  }
}
