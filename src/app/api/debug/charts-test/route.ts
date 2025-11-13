import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Endpoint de debug pour vérifier le calcul des graphiques
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodStart = searchParams.get('periodStart') || '2025-01';
    const periodEnd = searchParams.get('periodEnd') || '2025-12';

    // Charger les natures
    const natures = await prisma.natureEntity.findMany({
      select: {
        code: true,
        label: true,
        flow: true,
      },
    });
    const natureMap = new Map(natures.map(n => [n.code, n]));

    // Charger les transactions (avec ou sans accounting_month)
    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [
          {
            accounting_month: {
              gte: periodStart,
              lte: periodEnd,
            },
          },
          {
            accounting_month: null,
            date: {
              gte: new Date(periodStart + '-01'),
              lte: new Date(periodEnd + '-31'),
            },
          },
        ],
      },
      select: {
        id: true,
        amount: true,
        nature: true,
        accounting_month: true,
        date: true,
        label: true,
      },
      orderBy: {
        accounting_month: 'asc',
      },
    });

    // Analyser chaque transaction
    const analysis = transactions.map(t => {
      const natureData = t.nature ? natureMap.get(t.nature) : null;
      const amount = t.amount;
      
      let classification = 'UNKNOWN';
      if (natureData?.flow === 'INCOME') {
        classification = 'INCOME (from nature)';
      } else if (natureData?.flow === 'EXPENSE') {
        classification = 'EXPENSE (from nature)';
      } else if (amount > 0) {
        classification = 'INCOME (from amount sign)';
      } else if (amount < 0) {
        classification = 'EXPENSE (from amount sign)';
      }

      return {
        id: t.id,
        label: t.label?.substring(0, 50),
        month: t.accounting_month,
        amount: t.amount,
        nature: t.nature,
        natureLabel: natureData?.label || 'Non mappée',
        natureFlow: natureData?.flow || 'NULL',
        classification,
      };
    });

    // Calculer les totaux par mois
    const monthlyTotals = new Map<string, { income: number; expense: number; net: number; count: number }>();
    
    transactions.forEach(t => {
      // Utiliser accounting_month ou calculer depuis date
      let month = t.accounting_month;
      if (!month && t.date) {
        const d = new Date(t.date);
        month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }
      if (!month) return;

      const data = monthlyTotals.get(month) || { income: 0, expense: 0, net: 0, count: 0 };
      const natureData = t.nature ? natureMap.get(t.nature) : null;
      const amount = t.amount;
      
      data.count++;
      
      if (natureData?.flow === 'INCOME' || (amount > 0 && !natureData)) {
        data.income += Math.abs(amount);
        data.net += Math.abs(amount);
      } else if (natureData?.flow === 'EXPENSE' || (amount < 0 && !natureData)) {
        data.expense += Math.abs(amount);
        data.net -= Math.abs(amount);
      }
      
      monthlyTotals.set(month, data);
    });

    return NextResponse.json({
      period: { start: periodStart, end: periodEnd },
      totalTransactions: transactions.length,
      natures: natures.length,
      transactionAnalysis: analysis,
      monthlyTotals: Array.from(monthlyTotals.entries()).map(([month, data]) => ({
        month,
        ...data,
      })),
      summary: {
        totalIncome: Array.from(monthlyTotals.values()).reduce((sum, m) => sum + m.income, 0),
        totalExpense: Array.from(monthlyTotals.values()).reduce((sum, m) => sum + m.expense, 0),
        totalNet: Array.from(monthlyTotals.values()).reduce((sum, m) => sum + m.net, 0),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

