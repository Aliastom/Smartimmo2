import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope');

    if (!scope) {
      return NextResponse.json({ error: 'Scope parameter is required' }, { status: 400 });
    }

    let insights = {};

    switch (scope) {
      case 'biens':
        insights = await getBiensInsights();
        break;
      case 'locataires':
        insights = await getLocatairesInsights();
        break;
      case 'transactions':
        insights = await getTransactionsInsights();
        break;
      case 'documents':
        insights = await getDocumentsInsights();
        break;
      default:
        return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });
    }

    return NextResponse.json(insights);
  } catch (error) {
    console.error('Erreur lors de la rÃ©cupÃ©ration des insights:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

async function getBiensInsights() {
  const [totalProperties, propertiesWithLeases, leases] = await Promise.all([
    prisma.property.count(),
    prisma.property.count({
      where: {
        Lease: {
          some: {
            status: 'ACTIF'
          }
        }
      }
    }),
            prisma.lease.findMany({
              where: { status: 'ACTIF' },
              include: { Property: true }
            })
  ]);

  const occupiedProperties = propertiesWithLeases;
  const vacantProperties = totalProperties - occupiedProperties;
  const occupationRate = totalProperties > 0 ? occupiedProperties / totalProperties : 0;
  
  // Calculer les revenus mensuels
  const monthlyRevenue = leases.reduce((sum, lease) => {
    return sum + (lease.rentAmount || 0);
  }, 0);

  return {
    totalProperties,
    occupiedProperties,
    vacantProperties,
    monthlyRevenue,
    occupationRate
  };
}

async function getLocatairesInsights() {
  const [totalTenants, tenantsWithActiveLeases, tenantsWithoutLeases] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({
      where: {
        Lease: {
          some: { status: 'ACTIF' }
        }
      }
    }),
    prisma.tenant.count({
      where: {
        Lease: {
          none: { status: 'ACTIF' }
        }
      }
    })
  ]);

  // Pour l'instant, on met 0 pour les retards de paiement
  // Cette logique devra Ãªtre implÃ©mentÃ©e selon vos besoins mÃ©tier
  const overduePayments = 0;

  return {
    totalTenants,
    tenantsWithActiveLeases,
    tenantsWithoutLeases,
    overduePayments
  };
}

async function getTransactionsInsights() {
  const [totalTransactions, transactions, natures] = await Promise.all([
    prisma.transaction.count(),
    prisma.transaction.findMany(),
    prisma.natureEntity.findMany()
  ]);

  // Calculer les totaux par type
  let totalIncome = 0;
  let totalExpenses = 0;
  let unreconciledTransactions = 0;
  let anomalies = 0;

  // RÃ©cupÃ©rer les liens de documents pour calculer les transactions non rapprochÃ©es
  const documentLinks = await prisma.documentLink.findMany({
    where: { linkedType: 'transaction' }
  });
  
  const transactionIdsWithDocuments = new Set(
    documentLinks.map(link => link.linkedId)
  );

  // CrÃ©er un map des natures pour un accÃ¨s rapide
  const natureMap = new Map(natures.map(n => [n.code, n]));

  transactions.forEach(transaction => {
    const amount = transaction.amount || 0;
    
    // DÃ©terminer si c'est une recette ou une dÃ©pense basÃ© sur la nature
    const nature = natureMap.get(transaction.nature || '');
    if (nature?.natureType === 'RECETTE') {
      totalIncome += amount;
    } else if (nature?.natureType === 'DEPENSE') {
      totalExpenses += amount;
    }

    // VÃ©rifier si la transaction a un document liÃ©
    if (!transactionIdsWithDocuments.has(transaction.id)) {
      unreconciledTransactions++;
    }

    // DÃ©tecter les anomalies (montant nul, catÃ©gorie manquante)
    if (amount === 0 || !transaction.categoryId) {
      anomalies++;
    }
  });

  const netBalance = totalIncome - totalExpenses;

  // Calculer les Ã©chÃ©ances Ã  venir (30 jours)
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  
  const upcomingDueDates = await prisma.transaction.count({
    where: {
      date: {
        gte: new Date(),
        lte: thirtyDaysFromNow
      }
    }
  });

  return {
    totalTransactions,
    totalIncome,
    totalExpenses,
    netBalance,
    unreconciledTransactions,
    anomalies,
    upcomingDueDates
  };
}

async function getDocumentsInsights() {
  const [totalDocuments, pendingDocuments, classifiedDocuments, ocrFailedDocuments, draftDocuments] = await Promise.all([
    prisma.document.count({ where: { status: { not: 'DELETED' } } }),
    prisma.document.count({ where: { status: 'PENDING' } }),
    prisma.document.count({ where: { status: 'ACTIVE', documentTypeId: { not: null } } }),
    prisma.document.count({ where: { status: 'OCR_FAILED' } }),
    prisma.document.count({ where: { status: 'DRAFT' } })
  ]);

  const classificationRate = totalDocuments > 0 ? (classifiedDocuments / totalDocuments) * 100 : 0;

  return {
    totalDocuments,
    pendingDocuments,
    classifiedDocuments,
    ocrFailedDocuments,
    draftDocuments,
    classificationRate
  };
}
