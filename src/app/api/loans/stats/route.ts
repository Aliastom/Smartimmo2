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

    const where: any = { organizationId };
    if (propertyId) {
      where.propertyId = propertyId;
    }

    const loans = await prisma.loan.findMany({
      where,
      select: {
        id: true,
        principal: true,
        annualRatePct: true,
        startDate: true,
        durationMonths: true,
        isActive: true,
      },
    });

    const totalLoans = loans.length;
    // Calculer le capital restant approximatif (simplifié : on suppose que c'est le principal pour les prêts actifs)
    // En réalité, il faudrait calculer en fonction des paiements effectués
    const totalRemainingCapital = loans
      .filter(loan => loan.isActive)
      .reduce((sum, loan) => sum + Number(loan.principal), 0);

    // Intérêts payés dans la période (estimation)
    // TODO: Calculer précisément à partir d'un historique de paiements
    const interestPaid = 0;

    // Échéances < 60 jours (calcul à partir de startDate + durationMonths)
    const sixtyDaysFromNow = new Date();
    sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);
    const dueSoon = loans.filter(loan => {
      if (!loan.startDate || !loan.durationMonths) return false;
      const endDate = new Date(loan.startDate);
      endDate.setMonth(endDate.getMonth() + loan.durationMonths);
      return endDate <= sixtyDaysFromNow;
    }).length;

    return NextResponse.json({
      total: totalLoans,
      totalLoans,
      totalRemainingCapital,
      interestPaid,
      dueSoon,
    });
  } catch (error) {
    console.error('Error fetching loan stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch loan stats', details: error.message },
      { status: 500 }
    );
  }
}

