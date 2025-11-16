import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    
    const searchParams = request.nextUrl.searchParams;
    
    // Récupérer les paramètres de filtre
    const periodStart = searchParams.get('periodStart'); // Format: YYYY-MM
    const periodEnd = searchParams.get('periodEnd'); // Format: YYYY-MM
    const natureFilter = searchParams.get('natureFilter');
    const statusFilter = searchParams.get('statusFilter');
    const propertyId = searchParams.get('propertyId');
    const tenantId = searchParams.get('tenantId');
    const categoryId = searchParams.get('categoryId');

    // Construire les filtres Prisma
    const where: any = {
      organizationId, // Filtrer par organisation
      AND: [],
    };

    // Filtre par période comptable
    // Inclure les transactions avec accounting_month dans la période
    // ET celles avec accounting_month NULL mais date dans la période
    if (periodStart && periodEnd) {
      where.AND.push({
        OR: [
          {
            accounting_month: {
              gte: periodStart,
              lte: periodEnd,
            },
          },
          {
            accounting_month: null,
            date: {
              gte: new Date(periodStart + '-01'),
              lte: new Date(periodEnd + '-31'),
            },
          },
        ],
      });
    }

    // Filtre par propriété
    if (propertyId) {
      where.AND.push({ propertyId });
    }

    // Filtre par locataire
    if (tenantId) {
      where.AND.push({ tenantId });
    }

    // Filtre par catégorie
    if (categoryId) {
      where.AND.push({ categoryId });
    }

    // Si aucun filtre AND, simplifier le where
    if (where.AND.length === 0) {
      delete where.AND;
    }

    // Note: Le filtre par statut de rapprochement sera appliqué après la récupération
    // car il dépend de la présence de documents liés via DocumentLink

    // Charger toutes les natures pour faire le mapping
    const natures = await prisma.natureEntity.findMany({
      select: {
        code: true,
        label: true,
        flow: true,
      },
    });
    const natureMap = new Map(natures.map(n => [n.code, n]));

    // Récupérer toutes les transactions
    const transactions = await prisma.transaction.findMany({
      where,
      select: {
        id: true,
        amount: true,
        nature: true,
        accounting_month: true,
        date: true, // Fallback si accounting_month est NULL
        Category: {
          select: {
            label: true
          }
        }
      },
      orderBy: {
        accounting_month: 'asc',
      },
    });

    // Récupérer les liens de documents pour filtrer si nécessaire
    // Note: DocumentLink n'a pas organizationId, mais on filtre par les transactions déjà filtrées
    const transactionIds = transactions.map(t => t.id);
    const documentLinks = await prisma.documentLink.findMany({
      where: {
        linkedType: 'transaction',
        linkedId: { in: transactionIds },
        // Filtrer aussi par document.organizationId pour sécurité
        Document: {
          organizationId, // Filtrer les documents par organisation
        },
      },
      select: {
        linkedId: true
      }
    });

    // Créer un Set des IDs de transactions qui ont des documents
    const transactionsWithDocs = new Set(documentLinks.map(link => link.linkedId));

    // Filtrer selon le statut si demandé
    let filteredTransactions = transactions;
    if (statusFilter === 'rapprochee') {
      filteredTransactions = transactions.filter(t => transactionsWithDocs.has(t.id));
    } else if (statusFilter === 'nonRapprochee') {
      filteredTransactions = transactions.filter(t => !transactionsWithDocs.has(t.id));
    }

    // 1. Calculer l'évolution mensuelle cumulée (timeline)
    const monthlyMap = new Map<string, { income: number; expense: number; net: number }>();

    // Générer tous les mois dans la période
    const months: string[] = [];
    if (periodStart && periodEnd) {
      const startParts = periodStart.split('-');
      const endParts = periodEnd.split('-');
      const startYear = parseInt(startParts[0] || '2025');
      const startMonth = parseInt(startParts[1] || '1');
      const endYear = parseInt(endParts[0] || '2025');
      const endMonth = parseInt(endParts[1] || '12');
      
      let currentDate = new Date(startYear, startMonth - 1, 1);
      const endDate = new Date(endYear, endMonth - 1, 1);

      while (currentDate <= endDate) {
        const month = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        months.push(month);
        monthlyMap.set(month, { income: 0, expense: 0, net: 0 });
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }

    // Remplir les données mensuelles
    for (const transaction of filteredTransactions) {
      // Utiliser accounting_month ou calculer depuis date si NULL
      let month = transaction.accounting_month;
      if (!month && transaction.date) {
        const d = new Date(transaction.date);
        month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }
      if (!month) continue;

      const data = monthlyMap.get(month) || { income: 0, expense: 0, net: 0 };
      const natureData = transaction.nature ? natureMap.get(transaction.nature) : null;
      const amount = transaction.amount;
      
      // Logique de comptabilisation :
      // 1. Si nature avec flow défini → utiliser le flow
      // 2. Sinon, utiliser le signe du montant (négatif = dépense, positif = recette)
      
      if (natureData?.flow === 'INCOME' || (amount > 0 && !natureData)) {
        // Recette
        data.income += Math.abs(amount);
        data.net += Math.abs(amount);
      } else if (natureData?.flow === 'EXPENSE' || (amount < 0 && !natureData)) {
        // Dépense
        data.expense += Math.abs(amount);
        data.net -= Math.abs(amount);
      } else if (amount === 0) {
        // Montant nul, on ignore
        continue;
      } else {
        // Fallback : si positif = recette, si négatif = dépense
        if (amount > 0) {
          data.income += Math.abs(amount);
          data.net += Math.abs(amount);
        } else {
          data.expense += Math.abs(amount);
          data.net -= Math.abs(amount);
        }
      }
      
      monthlyMap.set(month, data);
    }

    // Calculer le cumulé
    let cumulated = 0;
    const timeline = months.map((month) => {
      const data = monthlyMap.get(month) || { income: 0, expense: 0, net: 0 };
      cumulated += data.net;
      
      return {
        month,
        income: data.income,
        expense: -data.expense, // Négatif pour l'affichage
        net: data.net,
        cumulated,
      };
    });

    // 2. Calculer la répartition par catégorie
    const categoryMap = new Map<string, number>();
    
    for (const transaction of filteredTransactions) {
      const categoryLabel = transaction.Category?.label || 'Non classé';
      const amount = Math.abs(transaction.amount);
      
      categoryMap.set(categoryLabel, (categoryMap.get(categoryLabel) || 0) + amount);
    }

    const byCategory = Array.from(categoryMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    // 3. Calculer Recettes vs Dépenses
    let income = 0;
    let expense = 0;

    for (const transaction of filteredTransactions) {
      const natureData = transaction.nature ? natureMap.get(transaction.nature) : null;
      
      if (natureData?.flow === 'INCOME') {
        income += Math.abs(transaction.amount);
      } else if (natureData?.flow === 'EXPENSE') {
        expense += Math.abs(transaction.amount);
      }
    }

    return NextResponse.json({
      timeline,
      byCategory,
      incomeExpense: {
        income,
        expense: -expense, // Négatif pour l'affichage
      },
    });
  } catch (error) {
    console.error('Erreur lors du calcul des graphiques:', error);
    return NextResponse.json(
      { error: 'Erreur lors du calcul des graphiques' },
      { status: 500 }
    );
  }
}

