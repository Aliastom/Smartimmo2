import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Periodicite, SensEcheance } from '@prisma/client';

/**
 * GET /api/echeances/kpis
 * Calcule les KPIs des échéances récurrentes (montants annuels)
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Récupérer toutes les échéances actives
    const echeances = await prisma.echeanceRecurrente.findMany({
      where: { isActive: true },
      select: {
        montant: true,
        sens: true,
        periodicite: true,
      },
    });

    // Fonction pour convertir en montant annuel
    const toAnnual = (montant: number, periodicite: Periodicite): number => {
      const amount = typeof montant === 'object' && 'toNumber' in montant
        ? (montant as any).toNumber()
        : parseFloat(montant.toString());

      switch (periodicite) {
        case 'MONTHLY':
          return amount * 12;
        case 'QUARTERLY':
          return amount * 4;
        case 'YEARLY':
          return amount;
        case 'ONCE':
          return amount; // Ponctuel = considéré comme annuel
        default:
          return amount;
      }
    };

    // Calculer les totaux
    let revenusAnnuels = 0;
    let chargesAnnuelles = 0;

    echeances.forEach((echeance) => {
      const montantAnnuel = toAnnual(
        typeof echeance.montant === 'object' && 'toNumber' in echeance.montant
          ? (echeance.montant as any).toNumber()
          : parseFloat(echeance.montant.toString()),
        echeance.periodicite
      );

      if (echeance.sens === SensEcheance.CREDIT) {
        revenusAnnuels += montantAnnuel;
      } else {
        chargesAnnuelles += Math.abs(montantAnnuel);
      }
    });

    // Compter les échéances
    const totalEcheances = await prisma.echeanceRecurrente.count();
    const echeancesActives = await prisma.echeanceRecurrente.count({
      where: { isActive: true },
    });

    return NextResponse.json({
      revenusAnnuels,
      chargesAnnuelles,
      totalEcheances,
      echeancesActives,
    });
  } catch (error: any) {
    console.error('[API] Error in /api/echeances/kpis:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors du calcul des KPIs' },
      { status: 500 }
    );
  }
}

