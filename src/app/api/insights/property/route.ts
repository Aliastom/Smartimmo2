import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const scope = searchParams.get('scope'); // transactions | documents | leases
    const period = searchParams.get('period') || 'month'; // month | quarter | year
    const detail = searchParams.get('detail'); // Pour les popovers dÃ©taillÃ©s

    if (!propertyId) {
      return NextResponse.json({ error: 'propertyId parameter is required' }, { status: 400 });
    }

    if (!scope) {
      return NextResponse.json({ error: 'scope parameter is required' }, { status: 400 });
    }

    let insights = {};

    switch (scope) {
      case 'transactions':
        insights = await getTransactionsInsights(propertyId, period, detail);
        break;
      case 'documents':
        insights = await getDocumentsInsights(propertyId, detail);
        break;
      case 'leases':
        insights = await getLeasesInsights(propertyId, detail);
        break;
      default:
        return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });
    }

    return NextResponse.json(insights);
  } catch (error) {
    console.error('Erreur lors de la rÃ©cupÃ©ration des insights property:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// ===== Transactions Insights =====
async function getTransactionsInsights(propertyId: string, period: string, detail?: string | null) {
  // Calculer les dates de pÃ©riode
  const now = new Date();
  let startDate = new Date();
  
  switch (period) {
    case 'month':
      startDate.setMonth(now.getMonth() - 1);
      break;
    case 'quarter':
      startDate.setMonth(now.getMonth() - 3);
      break;
    case 'year':
      startDate.setFullYear(now.getFullYear() - 1);
      break;
  }

  // RÃ©cupÃ©rer toutes les transactions du bien
  const allTransactions = await prisma.transaction.findMany({
    where: {
      propertyId: propertyId,
      date: {
        gte: startDate
      }
    },
    include: {
      Category: true,
      Lease_Transaction_leaseIdToLease: {
        include: {
          Tenant: true
        }
      }
    }
  });

  // Classification des transactions
  const incomeNatures = ['LOYER', 'AVOIR_REGULARISATION', 'DEPOT_GARANTIE_RECU'];
  const expenseNatures = ['REPARATION', 'TRAVAUX', 'CHARGES_PROPRIETAIRE', 'DEPOT_GARANTIE_RENDU', 'PENALITE_RETENUE'];

  const isIncome = (t: any) => {
    if (incomeNatures.includes(t.nature)) return true;
    if (expenseNatures.includes(t.nature)) return false;
    return (t.amount || 0) > 0;
  };

  const isExpense = (t: any) => {
    if (expenseNatures.includes(t.nature)) return true;
    if (incomeNatures.includes(t.nature)) return false;
    return (t.amount || 0) < 0;
  };

  const incomeTransactions = allTransactions.filter(isIncome);
  const expenseTransactions = allTransactions.filter(isExpense);

  const totalRevenue = incomeTransactions.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
  const totalExpenses = expenseTransactions.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
  const netIncome = totalRevenue - totalExpenses;

  // Anomalies (montant = 0 ou pas de catÃ©gorie)
  const anomalies = allTransactions.filter(t => (t.amount || 0) === 0 || !t.categoryId);
  
  // Non rapprochÃ©es (transactions sans document liÃ© - heuristique)
  // Note: On pourrait ajouter un champ hasDocument dans le schÃ©ma
  const unreconciled = allTransactions.filter(t => !t.paidAt && t.amount !== 0);

  // Si detail demandÃ©, calculer les donnÃ©es pour popovers
  let detailData = null;
  if (detail) {
    switch (detail) {
      case 'revenue':
        // Top 3 catÃ©gories de revenus
        const revenueByCat = incomeTransactions.reduce((acc, t) => {
          const catName = t.Category?.name || 'Non catÃ©gorisÃ©';
          acc[catName] = (acc[catName] || 0) + Math.abs(t.amount || 0);
          return acc;
        }, {} as Record<string, number>);
        detailData = Object.entries(revenueByCat)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3)
          .map(([name, amount]) => ({ name, amount }));
        break;
      
      case 'expenses':
        // Top 3 catÃ©gories de charges
        const expenseByCat = expenseTransactions.reduce((acc, t) => {
          const catName = t.Category?.name || 'Non catÃ©gorisÃ©';
          acc[catName] = (acc[catName] || 0) + Math.abs(t.amount || 0);
          return acc;
        }, {} as Record<string, number>);
        detailData = Object.entries(expenseByCat)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3)
          .map(([name, amount]) => ({ name, amount }));
        break;
      
      case 'net':
        // Sparkline des 30 derniers jours
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        const recentTransactions = allTransactions.filter(t => new Date(t.date) >= thirtyDaysAgo);
        
        // Grouper par jour
        const dailyNet = recentTransactions.reduce((acc, t) => {
          const day = new Date(t.date).toISOString().split('T')[0];
          acc[day] = (acc[day] || 0) + (isIncome(t) ? Math.abs(t.amount || 0) : -Math.abs(t.amount || 0));
          return acc;
        }, {} as Record<string, number>);
        
        detailData = {
          sparkline: Object.values(dailyNet),
          trend: netIncome > 0 ? '+' : '-',
          percentage: totalRevenue > 0 ? ((netIncome / totalRevenue) * 100).toFixed(1) : '0'
        };
        break;
    }
  }

  return {
    totalRevenue,
    totalExpenses,
    netIncome,
    transactionCount: allTransactions.length,
    unreconciledCount: unreconciled.length,
    anomalyCount: anomalies.length,
    trend: {
      revenue: '+5%', // Ã€ calculer avec pÃ©riode prÃ©cÃ©dente si besoin
      expenses: '+3%',
      net: netIncome > 0 ? '+8%' : '-2%'
    },
    detail: detailData
  };
}

// ===== Documents Insights =====
async function getDocumentsInsights(propertyId: string, detail?: string | null) {
  // Harmonisation avec le schÃ©ma Prisma (status/ocrStatus en minuscules)
  const [total, pending, classified, ocrFailed, drafts] = await Promise.all([
    prisma.document.count({
      where: { 
        propertyId,
        deletedAt: null
      }
    }),
    prisma.document.count({
      where: { 
        propertyId,
        deletedAt: null,
        status: 'pending'
      }
    }),
    prisma.document.count({
      where: { 
        propertyId,
        deletedAt: null,
        // Un document "classÃ©" = possÃ¨de un type
        documentTypeId: { not: null }
      }
    }),
    prisma.document.count({
      where: { 
        propertyId,
        deletedAt: null,
        ocrStatus: 'failed'
      }
    }),
    prisma.document.count({
      where: { 
        propertyId,
        deletedAt: null,
        status: 'draft'
      }
    })
  ]);

  const classificationRate = total > 0 ? (classified / total) * 100 : 0;

  // Si detail demandÃ©, calculer la rÃ©partition par type
  let detailData = null;
  if (detail === 'types') {
    const docsByType = await prisma.document.groupBy({
      by: ['documentTypeId'],
      where: {
        propertyId,
        deletedAt: null,
        documentTypeId: { not: null }
      },
      _count: true
    });

    // RÃ©cupÃ©rer les noms des types
    const typeIds = docsByType.map(d => d.documentTypeId).filter(Boolean) as string[];
    const types = await prisma.documentType.findMany({
      where: { id: { in: typeIds } },
      select: { id: true, name: true }
    });

    const typeMap = new Map(types.map(t => [t.id, t.name]));
    
    detailData = docsByType
      .map(d => ({
        type: typeMap.get(d.documentTypeId!) || 'Autre',
        count: d._count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }

  return {
    totalDocuments: total,
    pendingDocuments: pending,
    classifiedDocuments: classified,
    ocrFailedDocuments: ocrFailed,
    draftDocuments: drafts,
    classificationRate,
    detail: detailData
  };
}

// ===== Leases Insights =====
async function getLeasesInsights(propertyId: string, detail?: string | null) {
  const today = new Date();
  
  // RÃ©cupÃ©rer les baux du bien
  const leases = await prisma.lease.findMany({
    where: {
      propertyId: propertyId
    },
    include: {
      Tenant: true
    }
  });

  // Bail actif
  const activeLease = leases.find(l => 
    l.status === 'ACTIF' || 
    l.status === 'ACTIVE' ||
    (l.startDate <= today && (!l.endDate || l.endDate >= today))
  );

  // Loyer mensuel du bail actif
  const monthlyRent = activeLease?.rentAmount || 0;

  // Retards de paiement (sur Transactions: montant positif, non payÃ©es, date Ã©chue)
  const latePayments = await prisma.transaction.count({
    where: {
      propertyId: propertyId,
      amount: { gt: 0 },
      date: { lte: today },
      paidAt: null
    }
  });

  // Dates clÃ©s du bail actif
  let leaseStartDate = null;
  let leaseEndDate = null;
  let indexationInfo = null;

  if (activeLease) {
    leaseStartDate = activeLease.startDate;
    leaseEndDate = activeLease.endDate;
    
    // Indexation (si lastIndexationDate existe dans le schÃ©ma)
    if ('lastIndexationDate' in activeLease && activeLease.lastIndexationDate) {
      const lastIndexation = activeLease.lastIndexationDate as Date;
      const indexationRate = ('indexationRate' in activeLease ? activeLease.indexationRate : 2.5) as number;
      indexationInfo = {
        lastDate: lastIndexation,
        rate: indexationRate
      };
    }
  }

  // Ã‰chÃ©ances Ã  venir (30 jours)
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);
  
  const upcomingDueDates = await prisma.transaction.count({
    where: {
      propertyId: propertyId,
      amount: { gt: 0 },
      date: {
        gte: today,
        lte: thirtyDaysFromNow
      },
      paidAt: null
    }
  });

  // Si detail demandÃ©
  let detailData = null;
  if (detail === 'calendar' && activeLease) {
    detailData = {
      leaseStart: leaseStartDate,
      leaseEnd: leaseEndDate,
      monthsRemaining: leaseEndDate 
        ? Math.max(0, Math.ceil((new Date(leaseEndDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30)))
        : null,
      upcomingDueDates
    };
  }

  if (detail === 'indexation' && indexationInfo) {
    detailData = indexationInfo;
  }

  return {
    hasActiveLease: !!activeLease,
    leaseStartDate,
    leaseEndDate,
    monthlyRent,
    latePaymentsCount: latePayments,
    upcomingDueDates,
    indexationInfo,
    detail: detailData
  };
}

