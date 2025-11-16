import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildSchedule, crdAtDate } from '@/lib/finance/amortization';
import { requireAuth } from '@/lib/auth/getCurrentUser';

/**
 * GET /api/loans/charts
 * Génère les données pour les graphiques des prêts
 * Query params: ?from=YYYY-MM&to=YYYY-MM&propertyId=xxx
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const { searchParams } = new URL(request.url);
    
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || new Date().toISOString().substring(0, 7);
    const propertyId = searchParams.get('propertyId') || undefined;

    // Construire le where
    const where: any = {
      isActive: true,
      organizationId,
    };

    if (propertyId) {
      where.propertyId = propertyId;
    }

    // Récupérer tous les prêts actifs
    const loans = await prisma.loan.findMany({
      where,
      include: {
        property: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Générer la liste des mois dans la période
    const startDate = from ? new Date(from + '-01') : new Date(new Date().getFullYear(), 0, 1);
    const endDate = new Date(to + '-01');
    
    const months: string[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const month = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      months.push(month);
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    // 1. CRD global vs temps (Line chart)
    const crdTimeline: { month: string; crd: number }[] = [];
    
    for (const month of months) {
      let totalCRD = 0;
      
      for (const loan of loans) {
        // Vérifier si le prêt est actif à cette date
        const loanStartMonth = loan.startDate.toISOString().substring(0, 7);
        const loanEndMonth = loan.endDate?.toISOString().substring(0, 7);
        
        if (month >= loanStartMonth && (!loanEndMonth || month <= loanEndMonth)) {
          const schedule = buildSchedule({
            principal: Number(loan.principal),
            annualRatePct: Number(loan.annualRatePct),
            durationMonths: loan.durationMonths,
            defermentMonths: loan.defermentMonths,
            insurancePct: loan.insurancePct ? Number(loan.insurancePct) : 0,
            startDate: loan.startDate,
          });
          
          const crd = crdAtDate(schedule, month);
          totalCRD += crd;
        }
      }
      
      crdTimeline.push({
        month,
        crd: Math.round(totalCRD * 100) / 100,
      });
    }

    // 2. Répartition par bien (Donut chart) - CRD au mois 'to'
    const crdByProperty: { propertyName: string; crd: number; propertyId: string }[] = [];
    
    const propertiesMap = new Map<string, { name: string; crd: number }>();
    
    for (const loan of loans) {
      const schedule = buildSchedule({
        principal: Number(loan.principal),
        annualRatePct: Number(loan.annualRatePct),
        durationMonths: loan.durationMonths,
        defermentMonths: loan.defermentMonths,
        insurancePct: loan.insurancePct ? Number(loan.insurancePct) : 0,
        startDate: loan.startDate,
      });
      
      const crd = crdAtDate(schedule, to);
      
      if (crd > 0) {
        const existing = propertiesMap.get(loan.propertyId);
        if (existing) {
          existing.crd += crd;
        } else {
          propertiesMap.set(loan.propertyId, {
            name: loan.property.name,
            crd,
          });
        }
      }
    }
    
    for (const [propertyId, data] of propertiesMap.entries()) {
      crdByProperty.push({
        propertyId,
        propertyName: data.name,
        crd: Math.round(data.crd * 100) / 100,
      });
    }
    
    // Trier par CRD décroissant
    crdByProperty.sort((a, b) => b.crd - a.crd);

    // 3. Classement par coût d'intérêts (top 5)
    const loanCosts: { loanId: string; label: string; totalInterest: number }[] = [];
    
    for (const loan of loans) {
      const schedule = buildSchedule({
        principal: Number(loan.principal),
        annualRatePct: Number(loan.annualRatePct),
        durationMonths: loan.durationMonths,
        defermentMonths: loan.defermentMonths,
        insurancePct: loan.insurancePct ? Number(loan.insurancePct) : 0,
        startDate: loan.startDate,
      });
      
      const totalInterest = schedule.length > 0
        ? schedule[schedule.length - 1].cumulativeInterest
        : 0;
      
      if (totalInterest > 0) {
        loanCosts.push({
          loanId: loan.id,
          label: loan.label,
          totalInterest: Math.round(totalInterest * 100) / 100,
        });
      }
    }
    
    // Trier par coût décroissant et prendre le top 5
    loanCosts.sort((a, b) => b.totalInterest - a.totalInterest);
    const topCostlyLoans = loanCosts.slice(0, 5);

    return NextResponse.json({
      crdTimeline,
      crdByProperty,
      topCostlyLoans,
    });
  } catch (error) {
    console.error('Erreur lors du calcul des graphiques:', error);
    return NextResponse.json(
      { error: 'Erreur lors du calcul des graphiques' },
      { status: 500 }
    );
  }
}

