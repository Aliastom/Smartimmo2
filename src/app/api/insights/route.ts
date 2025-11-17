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
  // ✅ OPTIMISATION : Utiliser des requêtes agrégées au lieu de charger toutes les transactions
  const [totalTransactions, natures, documentLinks] = await Promise.all([
    prisma.transaction.count({ where: { organizationId } }),
    prisma.natureEntity.findMany(),
    prisma.documentLink.findMany({
      where: { linkedType: 'transaction', Document: { organizationId } },
      select: { linkedId: true } // Ne charger que l'ID pour économiser la mémoire
    })
  ]);

  // Créer un map des natures pour un accès rapide
  const natureMap = new Map(natures.map(n => [n.code, n]));
  
  // Créer un Set des transactions avec documents
  const transactionIdsWithDocuments = new Set(
    documentLinks.map(link => link.linkedId)
  );

  // ✅ OPTIMISATION : Calculer les totaux avec des requêtes agrégées
  // Pour RECETTE : natures avec natureType === 'RECETTE'
  const recetteCodes = natures
    .filter(n => n.natureType === 'RECETTE')
    .map(n => n.code);
  
  // Pour DEPENSE : natures avec natureType === 'DEPENSE'
  const depenseCodes = natures
    .filter(n => n.natureType === 'DEPENSE')
    .map(n => n.code);

  // Calculer les totaux avec une seule requête agrégée
  const [incomeResult, expenseResult, anomaliesResult] = await Promise.all([
    // Total des recettes
    recetteCodes.length > 0
      ? prisma.transaction.aggregate({
          where: {
            organizationId,
            nature: { in: recetteCodes }
          },
          _sum: { amount: true }
        })
      : { _sum: { amount: null } },
    // Total des dépenses
    depenseCodes.length > 0
      ? prisma.transaction.aggregate({
          where: {
            organizationId,
            nature: { in: depenseCodes }
          },
          _sum: { amount: true }
        })
      : { _sum: { amount: null } },
    // Anomalies : transactions sans catégorie ou montant nul
    prisma.transaction.count({
      where: {
        organizationId,
        OR: [
          { amount: 0 },
          { categoryId: null }
        ]
      }
    })
  ]);

  const totalIncome = Math.abs(incomeResult._sum.amount || 0);
  const totalExpenses = Math.abs(expenseResult._sum.amount || 0);
  const anomalies = anomaliesResult;

  // ✅ OPTIMISATION : Calculer les transactions non rapprochées avec une requête
  // au lieu de charger toutes les transactions en mémoire
  const unreconciledTransactions = await prisma.transaction.count({
    where: {
      organizationId,
      id: { notIn: Array.from(transactionIdsWithDocuments) }
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
