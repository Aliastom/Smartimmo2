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

    // Récupérer toutes les transactions correspondant aux filtres (accounting_month pour le cashflow mensuel)
    const transactions = await prisma.transaction.findMany({
      where,
      select: {
        id: true,
        amount: true,
        nature: true,
        rapprochementStatus: true,
        accounting_month: true,
        date: true,
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

    // Cashflow mensuel moyen = même règle que sidebar/page Biens : 12 derniers mois à partir d'aujourd'hui (une seule source de vérité)
    const CASHFLOW_PERIOD_MONTHS = 12;
    const monthlyTotals: Record<string, number> = {};
    for (const t of transactions) {
      const month = t.accounting_month ?? (t.date ? `${new Date(t.date).getFullYear()}-${String(new Date(t.date).getMonth() + 1).padStart(2, '0')}` : null);
      if (!month) continue;
      const amount = t.amount;
      const nd = t.nature ? natureMap.get(t.nature) : null;
      const signed = nd?.flow === 'EXPENSE' ? -Math.abs(amount) : Math.abs(amount);
      monthlyTotals[month] = (monthlyTotals[month] ?? 0) + signed;
    }
    const now = new Date();
    const last12MonthKeys: string[] = [];
    for (let i = CASHFLOW_PERIOD_MONTHS - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      last12MonthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const cashflowTotal = last12MonthKeys.reduce((sum, m) => sum + (monthlyTotals[m] ?? 0), 0);
    const cashflowMensuelMoyen = cashflowTotal / CASHFLOW_PERIOD_MONTHS;

    return NextResponse.json({
      recettesTotales,
      depensesTotales,
      soldeNet,
      nonRapprochees,
      cashflowMensuelMoyen,
      cashflowMoisCount: CASHFLOW_PERIOD_MONTHS,
    });
  } catch (error) {
    console.error('Erreur lors du calcul des KPI:', error);
    return NextResponse.json(
      { error: 'Erreur lors du calcul des KPI' },
      { status: 500 }
    );
  }
}


