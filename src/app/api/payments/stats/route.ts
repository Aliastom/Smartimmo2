import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    let where: any = { organizationId };

    if (propertyId) {
      where.propertyId = propertyId;
    }

    // Filtrer par période
    if (month && year) {
      // Filtrer par année et mois
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
      where.date = {
        gte: startDate,
        lte: endDate,
      };
    } else if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) {
        where.date.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.date.lte = new Date(dateTo);
      }
    } else {
      // Par défaut : mois en cours
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      where.date = {
        gte: startDate,
        lte: endDate,
      };
    }

    const payments = await prisma.payment.findMany({
      where,
      select: {
        amount: true,
        nature: true,
        accountingCategory: {
          select: {
            type: true,
          }
        },
      },
    });

    const totalTransactions = payments.length;
    
    // Revenus (nature LOYER/DEPOT_RECU OU accountingCategory.type = REVENU)
    const revenues = payments
      .filter(p => 
        ['LOYER', 'DEPOT_RECU'].includes(p.nature) || 
        p.accountingCategory?.type === 'REVENU'
      )
      .reduce((sum, p) => sum + p.amount, 0);

    // Dépenses (nature CHARGES/DEPOT_RENDU OU accountingCategory.type = DEPENSE)
    const expenses = payments
      .filter(p => 
        ['CHARGES', 'DEPOT_RENDU'].includes(p.nature) || 
        p.accountingCategory?.type === 'DEPENSE'
      )
      .reduce((sum, p) => sum + p.amount, 0);

    // Solde de la période (Revenus - Dépenses)
    const balance = revenues - expenses;

    return NextResponse.json({
      totalTransactions,
      rentReceived: revenues,
      chargesPaid: expenses,
      balance,
    });
  } catch (error) {
    console.error('Error fetching transaction stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transaction stats', details: error.message },
      { status: 500 }
    );
  }
}

