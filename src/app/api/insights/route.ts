import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope');

    if (!scope) {
      return NextResponse.json({ error: 'Scope parameter is required' }, { status: 400 });
    }

    let insights = {};

    switch (scope) {
      case 'biens':
        insights = await getBiensInsights(organizationId);
        break;
      case 'locataires':
        insights = await getLocatairesInsights(organizationId);
        break;
      case 'transactions':
        insights = await getTransactionsInsights(organizationId);
        break;
      case 'documents':
        insights = await getDocumentsInsights(organizationId);
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

async function getBiensInsights(organizationId: string) {
  const [totalProperties, propertiesWithLeases, leases] = await Promise.all([
    prisma.property.count({ where: { organizationId } }),
    prisma.property.count({
      where: {
        organizationId,
        Lease: {
          some: {
            status: 'ACTIF',
            organizationId,
          }
        }
      }
    }),
    prisma.lease.findMany({
      where: { status: 'ACTIF', organizationId },
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

async function getLocatairesInsights(organizationId: string) {
  const [totalTenants, tenantsWithActiveLeases, tenantsWithoutLeases] = await Promise.all([
    prisma.tenant.count({ where: { organizationId } }),
    prisma.tenant.count({
      where: {
        organizationId,
        Lease: {
          some: { status: 'ACTIF', organizationId }
        }
      }
    }),
    prisma.tenant.count({
      where: {
        organizationId,
        Lease: {
          none: { status: 'ACTIF', organizationId }
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

async function getTransactionsInsights(organizationId: string) {
  const [totalTransactions, transactions, natures] = await Promise.all([
    prisma.transaction.count({ where: { organizationId } }),
    prisma.transaction.findMany({ where: { organizationId } }),
    prisma.natureEntity.findMany()
  ]);

  // Calculer les totaux par type
  let totalIncome = 0;
  let totalExpenses = 0;
  let unreconciledTransactions = 0;
  let anomalies = 0;

  // RÃ©cupÃ©rer les liens de documents pour calculer les transactions non rapprochÃ©es
  const documentLinks = await prisma.documentLink.findMany({
    where: { linkedType: 'transaction', Document: { organizationId } }
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
      organizationId,
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

async function getDocumentsInsights(organizationId: string) {
  const [totalDocuments, pendingDocuments, classifiedDocuments, ocrFailedDocuments, draftDocuments] = await Promise.all([
    prisma.document.count({ where: { status: { not: 'DELETED' }, organizationId } }),
    prisma.document.count({ where: { status: 'PENDING', organizationId } }),
    prisma.document.count({ where: { status: 'ACTIVE', documentTypeId: { not: null }, organizationId } }),
    prisma.document.count({ where: { status: 'OCR_FAILED', organizationId } }),
    prisma.document.count({ where: { status: 'DRAFT', organizationId } })
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
