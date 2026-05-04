/* eslint-disable @typescript-eslint/naming-convention -- Route handlers Next.js App Router */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';

export const dynamic = 'force-dynamic';

function isAuthError(error: unknown): boolean {
  return error instanceof Error && error.message === 'Non authentifié';
}

const orderTypes = z.enum(['BUY', 'SELL', 'DIVIDEND', 'FEE', 'TAX', 'TRANSFER_IN', 'TRANSFER_OUT']);

const orderSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  assetSymbol: z
    .string()
    .transform((s) => (s.trim().length > 0 ? s.trim() : '-')),
  assetIsin: z.string().nullable().optional(),
  type: orderTypes,
  date: z.string().datetime(),
  quantity: z.number().finite(),
  unitPrice: z.number().finite().nullable().optional(),
  grossAmount: z.number().finite().nullable().optional(),
  fees: z.number().finite().optional(),
  taxes: z.number().finite().optional(),
  currency: z.string().min(1),
  note: z.string().nullable().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

function toApi(row: {
  id: string;
  organizationId: string;
  accountId: string;
  assetSymbol: string;
  assetIsin: string | null;
  type: string;
  date: Date;
  quantity: number;
  unitPrice: number | null;
  grossAmount: number | null;
  fees: number;
  taxes: number;
  currency: string;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    accountId: row.accountId,
    assetSymbol: row.assetSymbol,
    assetIsin: row.assetIsin,
    type: row.type,
    date: row.date.toISOString(),
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    grossAmount: row.grossAmount,
    fees: row.fees,
    taxes: row.taxes,
    currency: row.currency,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const limitRaw = request.nextUrl.searchParams.get('limit');
    const limit = limitRaw ? Math.max(1, Math.min(50_000, Number(limitRaw))) : 10_000;
    const rows = await prisma.portfolioOrder.findMany({
      where: { organizationId: user.organizationId },
      orderBy: [{ date: 'desc' }, { updatedAt: 'desc' }],
      take: Number.isFinite(limit) ? limit : 10_000,
    });
    return NextResponse.json({ success: true, data: rows.map(toApi) });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('[api/market/portfolio/orders GET]', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération des ordres' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const raw = await request.json();
    const parsed = orderSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });
    }
    const payload = parsed.data;
    const fees = payload.fees ?? 0;
    const taxes = payload.taxes ?? 0;

    const row = await prisma.portfolioOrder.upsert({
      where: { organizationId_id: { organizationId: user.organizationId, id: payload.id } },
      update: {
        accountId: payload.accountId,
        assetSymbol: payload.assetSymbol.trim(),
        assetIsin: payload.assetIsin ?? null,
        type: payload.type,
        date: new Date(payload.date),
        quantity: payload.quantity,
        unitPrice: payload.unitPrice ?? null,
        grossAmount: payload.grossAmount ?? null,
        fees,
        taxes,
        currency: payload.currency,
        note: payload.note ?? null,
        ...(payload.updatedAt ? { updatedAt: new Date(payload.updatedAt) } : {}),
      },
      create: {
        id: payload.id,
        organizationId: user.organizationId,
        accountId: payload.accountId,
        assetSymbol: payload.assetSymbol.trim(),
        assetIsin: payload.assetIsin ?? null,
        type: payload.type,
        date: new Date(payload.date),
        quantity: payload.quantity,
        unitPrice: payload.unitPrice ?? null,
        grossAmount: payload.grossAmount ?? null,
        fees,
        taxes,
        currency: payload.currency,
        note: payload.note ?? null,
        ...(payload.createdAt ? { createdAt: new Date(payload.createdAt) } : {}),
        ...(payload.updatedAt ? { updatedAt: new Date(payload.updatedAt) } : {}),
      },
    });
    return NextResponse.json({ success: true, data: toApi(row) }, { status: 201 });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('[api/market/portfolio/orders POST]', error);
    return NextResponse.json({ error: 'Erreur lors de la sauvegarde de l’ordre' }, { status: 500 });
  }
}
