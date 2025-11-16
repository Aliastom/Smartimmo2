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
    };

    // Filtre par période comptable
    if (periodStart && periodEnd) {
      where.accounting_month = {
        gte: periodStart,
        lte: periodEnd,
      };
    }

    // Filtre par propriété
    if (propertyId) {
      where.propertyId = propertyId;
    }

    // Filtre par locataire
    if (tenantId) {
      where.tenantId = tenantId;
    }

    // Filtre par catégorie
    if (categoryId) {
      where.categoryId = categoryId;
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

    // Récupérer toutes les transactions correspondant aux filtres
    const transactions = await prisma.transaction.findMany({
      where,
      select: {
        id: true,
        amount: true,
        nature: true,
        rapprochementStatus: true,
      },
    });

    // Filtrer selon le statut si demandé
    let filteredTransactions = transactions;
    if (statusFilter === 'rapprochee') {
      filteredTransactions = transactions.filter(t => t.rapprochementStatus === 'rapprochee');
    } else if (statusFilter === 'nonRapprochee') {
      filteredTransactions = transactions.filter(t => t.rapprochementStatus === 'non_rapprochee');
    }

    // Calculer les KPI
    let recettesTotales = 0;
    let depensesTotales = 0;
    let nonRapprochees = 0;

    for (const transaction of transactions) {
      const amount = transaction.amount;
      const natureData = transaction.nature ? natureMap.get(transaction.nature) : null;

      // Déterminer si c'est une recette ou une dépense selon le flow de la nature
      if (natureData?.flow === 'INCOME') {
        recettesTotales += Math.abs(amount);
      } else if (natureData?.flow === 'EXPENSE') {
        depensesTotales += -Math.abs(amount); // Négatif pour les dépenses
      }

      // Compter les transactions non rapprochées
      if (transaction.rapprochementStatus === 'non_rapprochee') {
        nonRapprochees++;
      }
    }

    const soldeNet = recettesTotales + depensesTotales; // depensesTotales est déjà négatif

    return NextResponse.json({
      recettesTotales,
      depensesTotales,
      soldeNet,
      nonRapprochees,
    });
  } catch (error) {
    console.error('Erreur lors du calcul des KPI:', error);
    return NextResponse.json(
      { error: 'Erreur lors du calcul des KPI' },
      { status: 500 }
    );
  }
}


