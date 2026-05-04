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
  name: z.string().min(1).optional(),
  kind: z.enum(['PEA', 'CTO', 'ASSURANCE_VIE', 'CRYPTO', 'AUTRE']).optional(),
  currency: z.string().min(1).optional(),
  inflationAnnualRate: z.number().finite().nullable().optional(),
  fiscalProfileId: z.string().nullable().optional(),
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
    const row = await prisma.portfolioAccount.update({
      where: { organizationId_id: { organizationId: user.organizationId, id } },
      data: {
        ...parsed.data,
        ...(parsed.data.updatedAt ? { updatedAt: new Date(parsed.data.updatedAt) } : {}),
      },
    });
    return NextResponse.json({
      success: true,
      data: {
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('[api/market/portfolio/accounts/[id] PUT]', error);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour du compte' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;
    await prisma.portfolioOrder.deleteMany({
      where: { organizationId: user.organizationId, accountId: id },
    });
    await prisma.portfolioAccount.delete({
      where: { organizationId_id: { organizationId: user.organizationId, id } },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('[api/market/portfolio/accounts/[id] DELETE]', error);
    return NextResponse.json({ error: 'Erreur lors de la suppression du compte' }, { status: 500 });
  }
}
