import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    const where = propertyId ? { propertyId } : {};

    const loans = await prisma.loan.findMany({
      where,
      select: {
        remainingCapital: true,
        interestRate: true,
        monthlyPayment: true,
        startDate: true,
        durationMonths: true,
      },
    });

    const totalLoans = loans.length;
    const totalRemainingCapital = loans.reduce((sum, loan) => sum + (loan.remainingCapital || 0), 0);

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

