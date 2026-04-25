import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';

export const dynamic = 'force-dynamic';

async function getOverrideForOrg(id: string, organizationId: string) {
  return prisma.lmnpExportOverride.findFirst({
    where: { id, organizationId },
    include: {
      Transaction: { select: { year: true, accounting_month: true, date: true, label: true } },
      Document: { select: { uploadedAt: true, fileName: true } },
      Loan: { select: { startDate: true, label: true } },
    },
  });
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authError = await protectAdminRoute();
  if (authError) return authError;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { id } = await context.params;
  const row = await getOverrideForOrg(id, user.organizationId);
  if (!row) {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: {
      id: row.id,
      organizationId: row.organizationId,
      transactionId: row.transactionId,
      documentId: row.documentId,
      loanId: row.loanId,
      lmnpBucket: row.lmnpBucket,
      lmnpLabel: row.lmnpLabel,
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
      Transaction: row.Transaction,
      Document: row.Document,
      Loan: row.Loan,
    },
  });
}

const patchSchema = z.object({
  lmnpBucket: z.string().min(1).optional(),
  lmnpLabel: z.string().min(1).optional(),
  reason: z.string().nullable().optional(),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authError = await protectAdminRoute();
  if (authError) return authError;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await getOverrideForOrg(id, user.organizationId);
  if (!existing) {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });
  }

  const { lmnpBucket, lmnpLabel, reason } = parsed.data;
  if (lmnpBucket === undefined && lmnpLabel === undefined && reason === undefined) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 });
  }

  try {
    const updated = await prisma.lmnpExportOverride.update({
      where: { id: existing.id },
      data: {
        ...(lmnpBucket !== undefined ? { lmnpBucket } : {}),
        ...(lmnpLabel !== undefined ? { lmnpLabel } : {}),
        ...(reason !== undefined ? { reason } : {}),
      },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (e) {
    console.error('[admin/lmnp/overrides PATCH]', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authError = await protectAdminRoute();
  if (authError) return authError;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await getOverrideForOrg(id, user.organizationId);
  if (!existing) {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  }

  try {
    await prisma.lmnpExportOverride.delete({ where: { id: existing.id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[admin/lmnp/overrides DELETE]', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
