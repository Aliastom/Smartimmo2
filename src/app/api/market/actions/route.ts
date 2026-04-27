import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';

export const dynamic = 'force-dynamic';

function isAuthError(error: unknown): boolean {
  return error instanceof Error && error.message === 'Non authentifié';
}

const createActionSchema = z.object({
  id: z.string().min(1),
  date: z.string().datetime(),
  type: z.enum(['DCA', 'REINFORCE_10', 'REINFORCE_20', 'REINFORCE_30', 'REINFORCE_MAX', 'MANUAL']),
  recommendedAmount: z.number().finite(),
  validatedAmount: z.number().finite(),
  cashBefore: z.number().finite(),
  cashAfter: z.number().finite(),
  reason: z.string().min(1),
  drawdownAtDecision: z.number().finite(),
  athPriceAtDecision: z.number().finite(),
  currentPriceAtDecision: z.number().finite(),
  symbolAtDecision: z.string().min(1),
  marketStatusAtDecision: z.enum(['NORMAL', 'OPPORTUNITE', 'FORTE_OPPORTUNITE']),
  athPeriodAtDecision: z.enum(['5Y', '10Y', 'MAX']),
  status: z.enum(['suggested', 'validated', 'ignored']),
  note: z.string().nullable().optional(),
  thresholdKey: z.string().nullable().optional(),
  marketLevelKey: z.string().nullable().optional(),
  drawdownPercentAtAction: z.number().finite().nullable().optional(),
  updatedAt: z.string().datetime().optional(),
});

function toResponseShape(row: any) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    date: row.date.toISOString(),
    type: row.type,
    recommendedAmount: row.recommendedAmount,
    validatedAmount: row.validatedAmount,
    cashBefore: row.cashBefore,
    cashAfter: row.cashAfter,
    reason: row.reason,
    drawdownAtDecision: row.drawdownAtDecision,
    athPriceAtDecision: row.athPriceAtDecision,
    currentPriceAtDecision: row.currentPriceAtDecision,
    symbolAtDecision: row.symbolAtDecision,
    marketStatusAtDecision: row.marketStatusAtDecision,
    athPeriodAtDecision: row.athPeriodAtDecision,
    status: row.status,
    note: row.note,
    thresholdKey: row.thresholdKey,
    marketLevelKey: row.marketLevelKey,
    drawdownPercentAtAction: row.drawdownPercentAtAction,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const limitRaw = request.nextUrl.searchParams.get('limit');
    const limit = limitRaw ? Math.max(1, Math.min(500, Number(limitRaw))) : 100;
    const rows = await prisma.marketInvestmentActionLog.findMany({
      where: { organizationId: user.organizationId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: Number.isFinite(limit) ? limit : 100,
    });
    return NextResponse.json({ success: true, data: rows.map(toResponseShape) });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('[api/market/actions GET]', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération des actions marché' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const raw = await request.json();
    const parsed = createActionSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });
    }
    const payload = parsed.data;

    const row = await prisma.marketInvestmentActionLog.upsert({
      where: { organizationId_id: { organizationId: user.organizationId, id: payload.id } },
      update: {
        date: new Date(payload.date),
        type: payload.type,
        recommendedAmount: payload.recommendedAmount,
        validatedAmount: payload.validatedAmount,
        cashBefore: payload.cashBefore,
        cashAfter: payload.cashAfter,
        reason: payload.reason,
        drawdownAtDecision: payload.drawdownAtDecision,
        athPriceAtDecision: payload.athPriceAtDecision,
        currentPriceAtDecision: payload.currentPriceAtDecision,
        symbolAtDecision: payload.symbolAtDecision,
        marketStatusAtDecision: payload.marketStatusAtDecision,
        athPeriodAtDecision: payload.athPeriodAtDecision,
        status: payload.status,
        note: payload.note ?? null,
        thresholdKey: payload.thresholdKey ?? null,
        marketLevelKey: payload.marketLevelKey ?? null,
        drawdownPercentAtAction: payload.drawdownPercentAtAction ?? null,
        ...(payload.updatedAt ? { updatedAt: new Date(payload.updatedAt) } : {}),
      },
      create: {
        id: payload.id,
        organizationId: user.organizationId,
        date: new Date(payload.date),
        type: payload.type,
        recommendedAmount: payload.recommendedAmount,
        validatedAmount: payload.validatedAmount,
        cashBefore: payload.cashBefore,
        cashAfter: payload.cashAfter,
        reason: payload.reason,
        drawdownAtDecision: payload.drawdownAtDecision,
        athPriceAtDecision: payload.athPriceAtDecision,
        currentPriceAtDecision: payload.currentPriceAtDecision,
        symbolAtDecision: payload.symbolAtDecision,
        marketStatusAtDecision: payload.marketStatusAtDecision,
        athPeriodAtDecision: payload.athPeriodAtDecision,
        status: payload.status,
        note: payload.note ?? null,
        thresholdKey: payload.thresholdKey ?? null,
        marketLevelKey: payload.marketLevelKey ?? null,
        drawdownPercentAtAction: payload.drawdownPercentAtAction ?? null,
        ...(payload.updatedAt ? { updatedAt: new Date(payload.updatedAt) } : {}),
      },
    });
    return NextResponse.json({ success: true, data: toResponseShape(row) }, { status: 201 });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('[api/market/actions POST]', error);
    return NextResponse.json({ error: 'Erreur lors de la sauvegarde de l’action marché' }, { status: 500 });
  }
}
