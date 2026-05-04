import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import {
  computeTransactionKpiTotals,
  resolveTransactionKind,
  type NatureFlowMap,
  type TransactionLike,
} from '@/features/transactions/lib/transactionAggregation';

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;

    const searchParams = request.nextUrl.searchParams;

    const periodStart = searchParams.get('periodStart');
    const periodEnd = searchParams.get('periodEnd');
    const statusFilter = searchParams.get('statusFilter');
    const propertyId = searchParams.get('propertyId');
    const tenantId = searchParams.get('tenantId');
    const categoryId = searchParams.get('categoryId');

    const where: Record<string, unknown> = {
      organizationId,
    };

    const andConditions: unknown[] = [];

    if (periodStart && periodEnd) {
      andConditions.push({
        OR: [
          {
            accounting_month: {
              gte: periodStart,
              lte: periodEnd,
            },
          },
          {
            AND: [
              { accounting_month: null },
              {
                date: {
                  gte: new Date(`${periodStart}-01`),
                  lte: new Date(`${periodEnd}-31`),
                },
              },
            ],
          },
        ],
      });
    }

    if (propertyId) {
      andConditions.push({ propertyId });
    }

    if (tenantId) {
      andConditions.push({ tenantId });
    }

    if (categoryId) {
      andConditions.push({ categoryId });
    }

    if (andConditions.length > 0) {
      (where as { AND: unknown[] }).AND = andConditions;
    }

    const natures = await prisma.natureEntity.findMany({
      select: {
        code: true,
        label: true,
        flow: true,
      },
    });
    const natureMap: NatureFlowMap = new Map(natures.map((n) => [n.code, n]));

    const transactions = await prisma.transaction.findMany({
      where,
      select: {
        id: true,
        amount: true,
        nature: true,
        rapprochementStatus: true,
        accounting_month: true,
        date: true,
      },
    });

    let filteredTransactions = transactions;
    if (statusFilter === 'rapprochee') {
      filteredTransactions = transactions.filter((t) => t.rapprochementStatus === 'rapprochee');
    } else if (statusFilter === 'nonRapprochee') {
      filteredTransactions = transactions.filter((t) => t.rapprochementStatus === 'non_rapprochee');
    }

    const rows: TransactionLike[] = filteredTransactions.map((t) => ({
      id: t.id,
      amount: t.amount,
      nature: t.nature,
      accounting_month: t.accounting_month,
      date: t.date,
      rapprochementStatus: t.rapprochementStatus ?? undefined,
    }));

    const { recettesTotales, depensesTotales, soldeNet, nonRapprochees } =
      computeTransactionKpiTotals(rows, natureMap);

    const CASHFLOW_PERIOD_MONTHS = 12;
    const monthlyTotals: Record<string, number> = {};
    for (const t of transactions) {
      const month =
        t.accounting_month ??
        (t.date
          ? `${new Date(t.date).getFullYear()}-${String(new Date(t.date).getMonth() + 1).padStart(2, '0')}`
          : null);
      if (!month) continue;
      const kind = resolveTransactionKind(
        {
          id: t.id,
          amount: t.amount,
          nature: t.nature,
        },
        natureMap
      );
      const abs = Math.abs(t.amount);
      const signed = kind === 'expense' ? -abs : abs;
      monthlyTotals[month] = (monthlyTotals[month] ?? 0) + signed;
    }
    const now = new Date();
    const last12MonthKeys: string[] = [];
    for (let i = CASHFLOW_PERIOD_MONTHS - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      last12MonthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const cashflowTotal = last12MonthKeys.reduce((sum, m) => sum + (monthlyTotals[m] ?? 0), 0);
    const cashflowMensuelMoyen = cashflowTotal / CASHFLOW_PERIOD_MONTHS;

    return NextResponse.json({
      recettesTotales,
      depensesTotales,
      soldeNet,
      nonRapprochees,
      cashflowMensuelMoyen,
      cashflowMoisCount: CASHFLOW_PERIOD_MONTHS,
    });
  } catch (error) {
    console.error('Erreur lors du calcul des KPI:', error);
    return NextResponse.json({ error: 'Erreur lors du calcul des KPI' }, { status: 500 });
  }
}
