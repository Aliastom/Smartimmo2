import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Endpoint de debug pour vérifier les accounting_month des transactions
 */
export async function GET() {
  try {
    const transactions = await prisma.transaction.findMany({
      select: {
        id: true,
        date: true,
        accounting_month: true,
        label: true,
        amount: true,
      },
      take: 10,
      orderBy: { date: 'desc' },
    });

    const countWithMonth = await prisma.transaction.count({
      where: { accounting_month: { not: null } },
    });

    const countWithoutMonth = await prisma.transaction.count({
      where: { accounting_month: null },
    });

    return NextResponse.json({
      sample: transactions,
      stats: {
        withAccountingMonth: countWithMonth,
        withoutAccountingMonth: countWithoutMonth,
        total: countWithMonth + countWithoutMonth,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

