import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';

export const dynamic = 'force-dynamic';

function isAuthError(error: unknown): boolean {
  return error instanceof Error && error.message === 'Non authentifié';
}

const reinforceLevelSchema = z.object({
  threshold: z.number().finite(),
  allocationPercent: z.number().finite().min(0).max(100),
});

const investmentStrategySchema = z.object({
  monthlyDca: z.number().finite().min(0),
  reinforceLevels: z.array(reinforceLevelSchema),
});

const marketSettingsSchema = z.object({
  id: z.string().min(1),
  referenceSymbol: z.string().min(1),
  referenceLabel: z.string().min(1),
  envelope: z.enum(['PEA', 'CTO', 'ASSURANCE_VIE']),
  athPeriod: z.enum(['5Y', '10Y', 'MAX']),
  availableCash: z.number().finite().min(0),
  monthlyDcaAmount: z.number().finite().min(0),
  reinforce10Threshold: z.number().finite().max(0),
  reinforce20Threshold: z.number().finite().max(0),
  reinforce10Amount: z.number().finite().min(0),
  reinforce20Amount: z.number().finite().min(0),
  strategy: z.enum(['DCA_ONLY', 'DCA_PLUS_REINFORCE']),
  cashReferenceAmount: z.number().finite().min(0),
  currency: z.string().min(1),
  peaSocialContributionsOnGainsRate: z.number().finite().min(0).max(1).optional(),
  investmentStrategy: investmentStrategySchema.nullish(),
  updatedAt: z.string().datetime().optional(),
});

function toResponseShape(row: {
  id: string;
  organizationId: string;
  referenceSymbol: string;
  referenceLabel: string;
  envelope: string;
  athPeriod: string;
  availableCash: number;
  monthlyDcaAmount: number;
  reinforce10Threshold: number;
  reinforce20Threshold: number;
  reinforce10Amount: number;
  reinforce20Amount: number;
  strategy: string;
  cashReferenceAmount: number;
  currency: string;
  peaSocialContributionsOnGainsRate: number | null;
  investmentStrategyJson: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
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

export async function GET() {
  try {
    const user = await requireAuth();
    const rows = await prisma.marketInvestmentSettings.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json({ success: true, data: rows.map(toResponseShape) });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('[api/market/settings GET]', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération des paramètres marché' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const raw = await request.json();
    const parsed = marketSettingsSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });
    }
    const payload = parsed.data;
    const updatedAt = payload.updatedAt ? new Date(payload.updatedAt) : undefined;

    const row = await prisma.marketInvestmentSettings.upsert({
      where: { organizationId_id: { organizationId: user.organizationId, id: payload.id } },
      update: {
        referenceSymbol: payload.referenceSymbol,
        referenceLabel: payload.referenceLabel,
        envelope: payload.envelope,
        athPeriod: payload.athPeriod,
        availableCash: payload.availableCash,
        monthlyDcaAmount: payload.monthlyDcaAmount,
        reinforce10Threshold: payload.reinforce10Threshold,
        reinforce20Threshold: payload.reinforce20Threshold,
        reinforce10Amount: payload.reinforce10Amount,
        reinforce20Amount: payload.reinforce20Amount,
        strategy: payload.strategy,
        cashReferenceAmount: payload.cashReferenceAmount,
        currency: payload.currency,
        peaSocialContributionsOnGainsRate: payload.peaSocialContributionsOnGainsRate ?? null,
        investmentStrategyJson: payload.investmentStrategy ? JSON.stringify(payload.investmentStrategy) : null,
        ...(updatedAt ? { updatedAt } : {}),
      },
      create: {
        id: payload.id,
        organizationId: user.organizationId,
        referenceSymbol: payload.referenceSymbol,
        referenceLabel: payload.referenceLabel,
        envelope: payload.envelope,
        athPeriod: payload.athPeriod,
        availableCash: payload.availableCash,
        monthlyDcaAmount: payload.monthlyDcaAmount,
        reinforce10Threshold: payload.reinforce10Threshold,
        reinforce20Threshold: payload.reinforce20Threshold,
        reinforce10Amount: payload.reinforce10Amount,
        reinforce20Amount: payload.reinforce20Amount,
        strategy: payload.strategy,
        cashReferenceAmount: payload.cashReferenceAmount,
        currency: payload.currency,
        peaSocialContributionsOnGainsRate: payload.peaSocialContributionsOnGainsRate ?? null,
        investmentStrategyJson: payload.investmentStrategy ? JSON.stringify(payload.investmentStrategy) : null,
        ...(updatedAt ? { updatedAt } : {}),
      },
    });

    return NextResponse.json({ success: true, data: toResponseShape(row) }, { status: 201 });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('[api/market/settings POST]', error);
    return NextResponse.json({ error: 'Erreur lors de la sauvegarde des paramètres marché' }, { status: 500 });
  }
}
