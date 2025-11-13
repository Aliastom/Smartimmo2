import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { expandEcheances } from '@/lib/echeances/expandEcheances';
import { Periodicite, SensEcheance } from '@prisma/client';

/**
 * GET /api/echeances/charts
 * Génère les données pour les graphiques de la page échéances
 * 
 * Query params:
 * - from: YYYY-MM
 * - to: YYYY-MM
 * - viewMode: 'monthly' | 'yearly'
 * - propertyId?: string (optionnel)
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') || getDefaultFrom();
    const to = searchParams.get('to') || getDefaultTo();
    const viewMode = searchParams.get('viewMode') || 'monthly';
    const propertyId = searchParams.get('propertyId') || undefined;

    // Parser les dates - Support pour format YYYY ou YYYY-MM
    const fromParts = from.split('-');
    const fromYear = parseInt(fromParts[0]);
    const fromMonth = fromParts[1] ? parseInt(fromParts[1]) : 1; // Janvier par défaut
    
    const toParts = to.split('-');
    const toYear = parseInt(toParts[0]);
    const toMonth = toParts[1] ? parseInt(toParts[1]) : 12; // Décembre par défaut
    
    const fromDate = new Date(fromYear, fromMonth - 1, 1);
    const toDate = new Date(toYear, toMonth, 0, 23, 59, 59);

    // Charger les échéances actives
    const where: any = {
      isActive: true,
      startAt: { lte: toDate },
      OR: [
        { endAt: null },
        { endAt: { gte: fromDate } },
      ],
    };

    if (propertyId) {
      where.propertyId = propertyId;
    }

    const echeances = await prisma.echeanceRecurrente.findMany({
      where,
      select: {
        id: true,
        propertyId: true,
        leaseId: true,
        label: true,
        type: true,
        periodicite: true,
        montant: true,
        recuperable: true,
        sens: true,
        startAt: true,
        endAt: true,
        isActive: true,
      },
    });

    // Convertir pour l'expansion
    const echeancesInput = echeances.map((e) => ({
      ...e,
      montant: typeof e.montant === 'object' && 'toNumber' in e.montant
        ? (e.montant as any).toNumber()
        : parseFloat(e.montant.toString()),
      startAt: e.startAt instanceof Date ? e.startAt : new Date(e.startAt),
      endAt: e.endAt ? (e.endAt instanceof Date ? e.endAt : new Date(e.endAt)) : null,
    }));

    // Générer les périodes selon le mode
    const periods = viewMode === 'yearly'
      ? generateYearPeriods(fromYear, toYear)
      : generateMonthPeriods(fromYear, fromMonth, toYear, toMonth);

    // Calculer les données cumulées
    const cumulativeData = periods.map((period) => {
      let credits = 0;
      let debits = 0;

      if (viewMode === 'yearly') {
        // Mode annuel : calculer le total annuel des échéances actives cette année
        const year = parseInt(period);
        const periodStart = new Date(year, 0, 1);
        const periodEnd = new Date(year, 11, 31, 23, 59, 59);
        
        echeancesInput.forEach((e) => {
          // L'échéance est active si :
          // - Elle a démarré avant ou pendant l'année
          // - ET (pas de fin OU la fin est après le début de l'année)
          const isActive = new Date(e.startAt) <= periodEnd && 
                          (!e.endAt || new Date(e.endAt) >= periodStart);
          
          if (isActive) {
            const montantAnnuel = toAnnual(e.montant, e.periodicite);
            
            if (e.sens === SensEcheance.CREDIT) {
              credits += montantAnnuel;
            } else {
              debits += Math.abs(montantAnnuel);
            }
          }
        });
      } else {
        // Mode mensuel : utiliser expandEcheances pour respecter la périodicité
        const occurrences = expandEcheances(echeancesInput, period, period);
        
        occurrences.forEach((occ) => {
          if (occ.sens === SensEcheance.CREDIT) {
            credits += occ.amount;
          } else {
            debits += Math.abs(occ.amount);
          }
        });
      }

      return {
        period,
        credits,
        debits: -debits, // Négatif pour l'affichage
        solde: credits - debits,
      };
    });

    // Répartition par type (montants annuels)
    const byTypeMap = new Map<string, { montant: number; count: number }>();
    
    echeancesInput.forEach((e) => {
      const montantAnnuel = toAnnual(e.montant, e.periodicite);
      const current = byTypeMap.get(e.type) || { montant: 0, count: 0 };
      byTypeMap.set(e.type, {
        montant: current.montant + montantAnnuel,
        count: current.count + 1,
      });
    });

    const byType = Array.from(byTypeMap.entries()).map(([type, data]) => ({
      type,
      montant: data.montant,
      count: data.count,
    }));

    // Charges récupérables vs non récupérables (montants annuels)
    let recuperables = 0;
    let nonRecuperables = 0;

    echeancesInput.forEach((e) => {
      if (e.sens === SensEcheance.DEBIT) {
        const montantAnnuel = toAnnual(e.montant, e.periodicite);
        if (e.recuperable) {
          recuperables += montantAnnuel;
        } else {
          nonRecuperables += montantAnnuel;
        }
      }
    });

    return NextResponse.json({
      cumulative: cumulativeData,
      byType,
      recuperables: { recuperables, nonRecuperables },
    });
  } catch (error: any) {
    console.error('[API] Error in /api/echeances/charts:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors du calcul des graphiques' },
      { status: 500 }
    );
  }
}

// Helpers
function getDefaultFrom() {
  const date = new Date();
  // Par défaut : à partir du mois en cours
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getDefaultTo() {
  const date = new Date();
  // Par défaut : 12 mois dans le futur
  date.setMonth(date.getMonth() + 11);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function generateMonthPeriods(fromYear: number, fromMonth: number, toYear: number, toMonth: number): string[] {
  const periods: string[] = [];
  let year = fromYear;
  let month = fromMonth;

  while (year < toYear || (year === toYear && month <= toMonth)) {
    periods.push(`${year}-${String(month).padStart(2, '0')}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return periods;
}

function generateYearPeriods(fromYear: number, toYear: number): string[] {
  const periods: string[] = [];
  for (let year = fromYear; year <= toYear; year++) {
    periods.push(year.toString());
  }
  return periods;
}

function toAnnual(montant: number, periodicite: Periodicite): number {
  switch (periodicite) {
    case Periodicite.MONTHLY:
      return montant * 12;
    case Periodicite.QUARTERLY:
      return montant * 4;
    case Periodicite.YEARLY:
      return montant;
    case Periodicite.ONCE:
      return montant;
    default:
      return montant;
  }
}

