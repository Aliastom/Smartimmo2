/* eslint-disable @typescript-eslint/naming-convention -- Route handlers Next.js App Router (GET, PATCH, PUT) */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { MarketInvestmentSettings } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';

export const dynamic = 'force-dynamic';

function isAuthError(error: unknown): boolean {
  return error instanceof Error && error.message === 'Non authentifié';
}

const patchSchema = z
  .object({
    referenceSymbol: z.string().min(1).optional(),
    referenceLabel: z.string().min(1).optional(),
    envelope: z.enum(['PEA', 'CTO', 'ASSURANCE_VIE']).optional(),
    athPeriod: z.enum(['5Y', '10Y', 'MAX']).optional(),
    availableCash: z.number().finite().min(0).optional(),
    monthlyDcaAmount: z.number().finite().min(0).optional(),
    reinforce10Threshold: z.number().finite().max(0).optional(),
    reinforce20Threshold: z.number().finite().max(0).optional(),
    reinforce10Amount: z.number().finite().min(0).optional(),
    reinforce20Amount: z.number().finite().min(0).optional(),
    strategy: z.enum(['DCA_ONLY', 'DCA_PLUS_REINFORCE']).optional(),
    cashReferenceAmount: z.number().finite().min(0).optional(),
    currency: z.string().min(1).optional(),
    peaSocialContributionsOnGainsRate: z.number().finite().min(0).max(1).nullable().optional(),
    investmentStrategy: z
      .object({
        monthlyDca: z.number().finite().min(0),
        reinforceLevels: z.array(
          z.object({
            threshold: z.number().finite(),
            allocationPercent: z.number().finite().min(0).max(100),
          })
        ),
        minCashReservePercent: z.number().finite().min(0).max(100).optional(),
        cautionCashRatioThreshold: z.number().finite().min(0.01).max(1).optional(),
        reinforceCooldownDays: z.number().finite().int().min(0).max(365).optional(),
        suggestionSuppressDays: z.number().finite().int().min(1).max(365).optional(),
        suggestionReopenDrawdownDelta: z.number().finite().min(0.5).max(50).optional(),
      })
      .nullable()
      .optional(),
    updatedAt: z.string().datetime().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: 'Aucun champ à mettre à jour' });

function toResponseShape(row: MarketInvestmentSettings) {
  let investmentStrategy: unknown = null;
  if (row.investmentStrategyJson) {
    try {
      investmentStrategy = JSON.parse(row.investmentStrategyJson);
    } catch {
      investmentStrategy = null;
    }
  }
  return {
    id: row.id,
    organizationId: row.organizationId,
    referenceSymbol: row.referenceSymbol,
    referenceLabel: row.referenceLabel,
    envelope: row.envelope,
    athPeriod: row.athPeriod,
    availableCash: row.availableCash,
    monthlyDcaAmount: row.monthlyDcaAmount,
    reinforce10Threshold: row.reinforce10Threshold,
    reinforce20Threshold: row.reinforce20Threshold,
    reinforce10Amount: row.reinforce10Amount,
    reinforce20Amount: row.reinforce20Amount,
    strategy: row.strategy,
    cashReferenceAmount: row.cashReferenceAmount,
    currency: row.currency,
    peaSocialContributionsOnGainsRate: row.peaSocialContributionsOnGainsRate ?? undefined,
    investmentStrategy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    const row = await prisma.marketInvestmentSettings.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!row) {
      return NextResponse.json({ error: 'Paramètres introuvables' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: toResponseShape(row) });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('[api/market/settings/:id GET]', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération des paramètres marché' }, { status: 500 });
  }
}

async function updateSettings(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    const existing = await prisma.marketInvestmentSettings.findFirst({
      where: { id, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Paramètres introuvables' }, { status: 404 });
    }

    const raw = await request.json();
    const parsed = patchSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });
    }
    const payload = parsed.data;

    const row = await prisma.marketInvestmentSettings.update({
      where: { organizationId_id: { organizationId: user.organizationId, id } },
      data: {
        ...(payload.referenceSymbol !== undefined ? { referenceSymbol: payload.referenceSymbol } : {}),
        ...(payload.referenceLabel !== undefined ? { referenceLabel: payload.referenceLabel } : {}),
        ...(payload.envelope !== undefined ? { envelope: payload.envelope } : {}),
        ...(payload.athPeriod !== undefined ? { athPeriod: payload.athPeriod } : {}),
        ...(payload.availableCash !== undefined ? { availableCash: payload.availableCash } : {}),
        ...(payload.monthlyDcaAmount !== undefined ? { monthlyDcaAmount: payload.monthlyDcaAmount } : {}),
        ...(payload.reinforce10Threshold !== undefined ? { reinforce10Threshold: payload.reinforce10Threshold } : {}),
        ...(payload.reinforce20Threshold !== undefined ? { reinforce20Threshold: payload.reinforce20Threshold } : {}),
        ...(payload.reinforce10Amount !== undefined ? { reinforce10Amount: payload.reinforce10Amount } : {}),
        ...(payload.reinforce20Amount !== undefined ? { reinforce20Amount: payload.reinforce20Amount } : {}),
        ...(payload.strategy !== undefined ? { strategy: payload.strategy } : {}),
        ...(payload.cashReferenceAmount !== undefined ? { cashReferenceAmount: payload.cashReferenceAmount } : {}),
        ...(payload.currency !== undefined ? { currency: payload.currency } : {}),
        ...(payload.peaSocialContributionsOnGainsRate !== undefined
          ? { peaSocialContributionsOnGainsRate: payload.peaSocialContributionsOnGainsRate }
          : {}),
        ...(payload.investmentStrategy !== undefined
          ? { investmentStrategyJson: payload.investmentStrategy ? JSON.stringify(payload.investmentStrategy) : null }
          : {}),
        ...(payload.updatedAt ? { updatedAt: new Date(payload.updatedAt) } : {}),
      },
    });
    return NextResponse.json({ success: true, data: toResponseShape(row) });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('[api/market/settings/:id PATCH]', error);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour des paramètres marché' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return updateSettings(request, context);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return updateSettings(request, context);
}
