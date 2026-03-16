import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import type { AnnualTimelineMonth } from '@/types/dashboard';

export const dynamic = 'force-dynamic';

const MOIS_LABELS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

/**
 * GET /api/dashboard/annual?year=YYYY
 * Retourne la timeline financière annuelle (12 mois) : loyers encaissés, dépenses, cashflow, cashflow cumulé.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const yearParam = request.nextUrl.searchParams.get('year');
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
    if (Number.isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'Année invalide' }, { status: 400 });
    }

    const natures = await prisma.natureEntity.findMany({
      select: { code: true, flow: true },
    });
    const natureMap = new Map(natures.map((n) => [n.code, n]));

    const months: AnnualTimelineMonth[] = [];
    let cumul = 0;

    for (let m = 1; m <= 12; m++) {
      const monthStr = `${year}-${String(m).padStart(2, '0')}`;
      const transactions = await prisma.transaction.findMany({
        where: {
          organizationId,
          accounting_month: monthStr,
        },
        select: { amount: true, nature: true },
      });

      let loyersEncaisses = 0;
      let depenses = 0;
      for (const tx of transactions) {
        const flow = tx.nature ? natureMap.get(tx.nature)?.flow?.toUpperCase() : null;
        const amount = Math.abs(tx.amount);
        if (flow === 'INCOME') loyersEncaisses += amount;
        if (flow === 'EXPENSE') depenses += amount;
      }
      const cashflow = loyersEncaisses - depenses;
      cumul += cashflow;
      months.push({
        month: monthStr,
        label: MOIS_LABELS[m - 1],
        loyers_encaisses: loyersEncaisses,
        depenses,
        cashflow,
        cashflow_cumule: cumul,
      });
    }

    return NextResponse.json({ months });
  } catch (error) {
    console.error('Erreur lors du calcul de la timeline annuelle:', error);
    return NextResponse.json(
      { error: 'Erreur lors du calcul de la timeline annuelle' },
      { status: 500 }
    );
  }
}
