import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';
import { requireAuth } from '@/lib/auth/getCurrentUser';

/**
 * Endpoint de debug pour vérifier les accounting_month des transactions
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET() {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    
    const transactions = await prisma.transaction.findMany({
      where: { organizationId },
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
      where: { 
        organizationId,
        accounting_month: { not: null } 
      },
    });

    const countWithoutMonth = await prisma.transaction.count({
      where: { 
        organizationId,
        accounting_month: null 
      },
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

