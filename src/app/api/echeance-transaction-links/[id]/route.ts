import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { isEcheanceTransactionLinkTableMissing } from '@/lib/prisma/echeanceLinkTableMissing';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;

    const link = await prisma.echeanceTransactionLink.findFirst({
      where: { id: params.id },
      include: { Echeance: { select: { organizationId: true } } },
    });
    if (!link || link.Echeance.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Lien introuvable' }, { status: 404 });
    }

    await prisma.echeanceTransactionLink.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (isEcheanceTransactionLinkTableMissing(e)) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    console.error('[echeance-transaction-links DELETE]', e);
    return NextResponse.json({ error: e?.message || 'Erreur serveur' }, { status: 500 });
  }
}
