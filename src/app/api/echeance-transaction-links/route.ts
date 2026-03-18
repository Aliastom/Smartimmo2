import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { isEcheanceTransactionLinkTableMissing } from '@/lib/prisma/echeanceLinkTableMissing';

export const dynamic = 'force-dynamic';

const PostSchema = z.object({
  echeanceId: z.string().min(1),
  transactionId: z.string().min(1),
  matchType: z.enum(['manual', 'auto', 'suggested']).default('manual'),
  occurrenceDate: z.string().optional().nullable(),
  confidenceScore: z.number().optional().nullable(),
});

/**
 * GET ?propertyId= — liens pour toutes les échéances du bien (+ détail transaction minimal)
 */
export async function GET(request: NextRequest) {
  try {
    if (!prisma?.echeanceRecurrente || !prisma?.echeanceTransactionLink) {
      console.error('[echeance-transaction-links GET] Prisma client missing echeanceRecurrente or echeanceTransactionLink. Run: npx prisma generate');
      return NextResponse.json(
        { error: 'Service temporairement indisponible', code: 'PRISMA_NOT_READY' },
        { status: 503 }
      );
    }

    const user = await requireAuth();
    const organizationId = user.organizationId;
    const propertyId = request.nextUrl.searchParams.get('propertyId');
    const echeanceId = request.nextUrl.searchParams.get('echeanceId');
    const transactionId = request.nextUrl.searchParams.get('transactionId');

    if (transactionId) {
      const tx = await prisma.transaction.findFirst({
        where: { id: transactionId, organizationId },
        select: { id: true, propertyId: true },
      });
      if (!tx) {
        return NextResponse.json({ item: null }, { status: 200 });
      }
      const link = await prisma.echeanceTransactionLink.findUnique({
        where: { transactionId },
        include: {
          Echeance: { select: { id: true, label: true, propertyId: true } },
        },
      });
      if (link && link.Echeance?.propertyId !== tx.propertyId) {
        return NextResponse.json({ item: null }, { status: 200 });
      }
      return NextResponse.json({ item: link || null });
    }

    if (echeanceId) {
      const echeance = await prisma.echeanceRecurrente.findFirst({
        where: { id: echeanceId, organizationId },
      });
      if (!echeance) {
        return NextResponse.json({ error: 'Échéance introuvable' }, { status: 404 });
      }
      const links = await prisma.echeanceTransactionLink.findMany({
        where: { echeanceId },
        include: {
          Transaction: {
            select: {
              id: true,
              label: true,
              amount: true,
              date: true,
              propertyId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ items: links });
    }

    if (!propertyId) {
      return NextResponse.json({ error: 'propertyId ou echeanceId requis' }, { status: 400 });
    }

    const echeances = await prisma.echeanceRecurrente.findMany({
      where: { organizationId, propertyId },
      select: { id: true },
    });
    const ids = echeances.map((e) => e.id);
    if (ids.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const links = await prisma.echeanceTransactionLink.findMany({
      where: { echeanceId: { in: ids } },
      include: {
        Transaction: {
          select: {
            id: true,
            label: true,
            amount: true,
            date: true,
            propertyId: true,
          },
        },
        Echeance: { select: { id: true, propertyId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ items: links });
  } catch (e: any) {
    if (isEcheanceTransactionLinkTableMissing(e)) {
      console.warn(
        '[echeance-transaction-links GET] Table EcheanceTransactionLink absente — App Shell utilise IDB. Appliquer: npx prisma migrate deploy'
      );
      const transactionId = request.nextUrl.searchParams.get('transactionId');
      const echeanceId = request.nextUrl.searchParams.get('echeanceId');
      if (transactionId) return NextResponse.json({ item: null }, { status: 200 });
      if (echeanceId) return NextResponse.json({ items: [] }, { status: 200 });
      return NextResponse.json({ items: [] }, { status: 200 });
    }
    console.error('[echeance-transaction-links GET]', e);
    return NextResponse.json({ error: e?.message || 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const body = await request.json();
    const parsed = PostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });
    }
    const { echeanceId, transactionId, matchType, occurrenceDate, confidenceScore } = parsed.data;

    const echeance = await prisma.echeanceRecurrente.findFirst({
      where: { id: echeanceId, organizationId },
    });
    if (!echeance) {
      return NextResponse.json({ error: 'Échéance introuvable' }, { status: 404 });
    }

    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, organizationId },
    });
    if (!transaction) {
      return NextResponse.json({ error: 'Transaction introuvable' }, { status: 404 });
    }

    if (echeance.propertyId && transaction.propertyId !== echeance.propertyId) {
      return NextResponse.json(
        { error: 'La transaction doit appartenir au même bien que l’échéance' },
        { status: 400 }
      );
    }

    const existingTx = await prisma.echeanceTransactionLink.findUnique({
      where: { transactionId },
    });
    if (existingTx) {
      return NextResponse.json(
        { error: 'Cette transaction est déjà liée à une échéance' },
        { status: 409 }
      );
    }

    const dup = await prisma.echeanceTransactionLink.findUnique({
      where: {
        echeanceId_transactionId: { echeanceId, transactionId },
      },
    });
    if (dup) {
      return NextResponse.json({ item: dup }, { status: 200 });
    }

    const item = await prisma.echeanceTransactionLink.create({
      data: {
        echeanceId,
        transactionId,
        matchType,
        occurrenceDate: occurrenceDate ?? null,
        confidenceScore: confidenceScore ?? null,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (e: any) {
    if (isEcheanceTransactionLinkTableMissing(e)) {
      console.warn('[echeance-transaction-links POST] Table absente — lien uniquement local (IDB)');
      return NextResponse.json(
        {
          error:
            'La table des liaisons échéance–transaction n’existe pas sur ce serveur. Exécutez : npx prisma migrate deploy',
          code: 'ECHEANCE_LINK_TABLE_MISSING',
        },
        { status: 503 }
      );
    }
    console.error('[echeance-transaction-links POST]', e);
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'Lien déjà existant' }, { status: 409 });
    }
    return NextResponse.json({ error: e?.message || 'Erreur serveur' }, { status: 500 });
  }
}
