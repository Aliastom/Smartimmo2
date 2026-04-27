import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';

export const dynamic = 'force-dynamic';

function isAuthError(error: unknown): boolean {
  return error instanceof Error && error.message === 'Non authentifié';
}

const patchSchema = z
  .object({
    date: z.string().datetime().optional(),
    type: z.enum(['DCA', 'REINFORCE_10', 'REINFORCE_20', 'REINFORCE_30', 'REINFORCE_MAX', 'MANUAL']).optional(),
    recommendedAmount: z.number().finite().optional(),
    validatedAmount: z.number().finite().optional(),
    cashBefore: z.number().finite().optional(),
    cashAfter: z.number().finite().optional(),
    reason: z.string().min(1).optional(),
    drawdownAtDecision: z.number().finite().optional(),
    athPriceAtDecision: z.number().finite().optional(),
    currentPriceAtDecision: z.number().finite().optional(),
    symbolAtDecision: z.string().min(1).optional(),
    marketStatusAtDecision: z.enum(['NORMAL', 'OPPORTUNITE', 'FORTE_OPPORTUNITE']).optional(),
    athPeriodAtDecision: z.enum(['5Y', '10Y', 'MAX']).optional(),
    status: z.enum(['suggested', 'validated', 'ignored']).optional(),
    note: z.string().nullable().optional(),
    thresholdKey: z.string().nullable().optional(),
    marketLevelKey: z.string().nullable().optional(),
    drawdownPercentAtAction: z.number().finite().nullable().optional(),
    updatedAt: z.string().datetime().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: 'Aucun champ à mettre à jour' });

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

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    const row = await prisma.marketInvestmentActionLog.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!row) {
      return NextResponse.json({ error: 'Action introuvable' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: toResponseShape(row) });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('[api/market/actions/:id GET]', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération de l’action marché' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    const existing = await prisma.marketInvestmentActionLog.findFirst({
      where: { id, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Action introuvable' }, { status: 404 });
    }
    const raw = await request.json();
    const parsed = patchSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });
    }
    const payload = parsed.data;

    const row = await prisma.marketInvestmentActionLog.update({
      where: { organizationId_id: { organizationId: user.organizationId, id } },
      data: {
        ...(payload.date !== undefined ? { date: new Date(payload.date) } : {}),
        ...(payload.type !== undefined ? { type: payload.type } : {}),
        ...(payload.recommendedAmount !== undefined ? { recommendedAmount: payload.recommendedAmount } : {}),
        ...(payload.validatedAmount !== undefined ? { validatedAmount: payload.validatedAmount } : {}),
        ...(payload.cashBefore !== undefined ? { cashBefore: payload.cashBefore } : {}),
        ...(payload.cashAfter !== undefined ? { cashAfter: payload.cashAfter } : {}),
        ...(payload.reason !== undefined ? { reason: payload.reason } : {}),
        ...(payload.drawdownAtDecision !== undefined ? { drawdownAtDecision: payload.drawdownAtDecision } : {}),
        ...(payload.athPriceAtDecision !== undefined ? { athPriceAtDecision: payload.athPriceAtDecision } : {}),
        ...(payload.currentPriceAtDecision !== undefined ? { currentPriceAtDecision: payload.currentPriceAtDecision } : {}),
        ...(payload.symbolAtDecision !== undefined ? { symbolAtDecision: payload.symbolAtDecision } : {}),
        ...(payload.marketStatusAtDecision !== undefined ? { marketStatusAtDecision: payload.marketStatusAtDecision } : {}),
        ...(payload.athPeriodAtDecision !== undefined ? { athPeriodAtDecision: payload.athPeriodAtDecision } : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
        ...(payload.note !== undefined ? { note: payload.note } : {}),
        ...(payload.thresholdKey !== undefined ? { thresholdKey: payload.thresholdKey } : {}),
        ...(payload.marketLevelKey !== undefined ? { marketLevelKey: payload.marketLevelKey } : {}),
        ...(payload.drawdownPercentAtAction !== undefined ? { drawdownPercentAtAction: payload.drawdownPercentAtAction } : {}),
        ...(payload.updatedAt !== undefined ? { updatedAt: new Date(payload.updatedAt) } : {}),
      },
    });
    return NextResponse.json({ success: true, data: toResponseShape(row) });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('[api/market/actions/:id PATCH]', error);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour de l’action marché' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    const existing = await prisma.marketInvestmentActionLog.findFirst({
      where: { id, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Action introuvable' }, { status: 404 });
    }
    await prisma.marketInvestmentActionLog.delete({ where: { organizationId_id: { organizationId: user.organizationId, id } } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('[api/market/actions/:id DELETE]', error);
    return NextResponse.json({ error: 'Erreur lors de la suppression de l’action marché' }, { status: 500 });
  }
}
