/* eslint-disable @typescript-eslint/naming-convention -- Route handlers Next.js App Router */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';

export const dynamic = 'force-dynamic';

function isAuthError(error: unknown): boolean {
  return error instanceof Error && error.message === 'Non authentifié';
}

const patchSchema = z.object({
  accountId: z.string().min(1).optional(),
  assetSymbol: z.string().min(1).optional(),
  assetIsin: z.string().nullable().optional(),
  type: z.enum(['BUY', 'SELL', 'DIVIDEND', 'FEE', 'TAX', 'TRANSFER_IN', 'TRANSFER_OUT']).optional(),
  date: z.string().datetime().optional(),
  quantity: z.number().finite().optional(),
  unitPrice: z.number().finite().nullable().optional(),
  grossAmount: z.number().finite().nullable().optional(),
  fees: z.number().finite().optional(),
  taxes: z.number().finite().optional(),
  currency: z.string().min(1).optional(),
  note: z.string().nullable().optional(),
  updatedAt: z.string().datetime().optional(),
});

export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;
    const raw = await request.json();
    const parsed = patchSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });
    }
    const p = parsed.data;
    const data: Record<string, unknown> = {};
    if (p.accountId !== undefined) data.accountId = p.accountId;
    if (p.assetSymbol !== undefined) data.assetSymbol = p.assetSymbol.trim() || '-';
    if (p.assetIsin !== undefined) data.assetIsin = p.assetIsin;
    if (p.type !== undefined) data.type = p.type;
    if (p.date !== undefined) data.date = new Date(p.date);
    if (p.quantity !== undefined) data.quantity = p.quantity;
    if (p.unitPrice !== undefined) data.unitPrice = p.unitPrice;
    if (p.grossAmount !== undefined) data.grossAmount = p.grossAmount;
    if (p.fees !== undefined) data.fees = p.fees;
    if (p.taxes !== undefined) data.taxes = p.taxes;
    if (p.currency !== undefined) data.currency = p.currency;
    if (p.note !== undefined) data.note = p.note;
    if (p.updatedAt !== undefined) data.updatedAt = new Date(p.updatedAt);
    const row = await prisma.portfolioOrder.update({
      where: { organizationId_id: { organizationId: user.organizationId, id } },
      data,
    });
    return NextResponse.json({
      success: true,
      data: {
        ...row,
        date: row.date.toISOString(),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('[api/market/portfolio/orders/[id] PUT]', error);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour de l’ordre' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;
    await prisma.portfolioOrder.delete({
      where: { organizationId_id: { organizationId: user.organizationId, id } },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('[api/market/portfolio/orders/[id] DELETE]', error);
    return NextResponse.json({ error: 'Erreur lors de la suppression de l’ordre' }, { status: 500 });
  }
}
