/**
 * API Route: Agrégation des données fiscales
 * POST /api/fiscal/aggregate
 * 
 * Récupère les données SmartImmo agrégées (biens, revenus, charges)
 * sans effectuer de simulation complète.
 * 
 * ⚠️ Multi-tenant : requireAuth obligatoire, organizationId utilisé.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { FiscalAggregator } from '@/services/tax/FiscalAggregator';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;

    const body = await request.json();
    const { year, baseCalcul = 'encaisse', scope } = body;
    // ⚠️ userId depuis le client ignoré (sécurité multi-tenant)

    const yearNum = year || new Date().getFullYear();

    const aggregated = await FiscalAggregator.aggregate({
      organizationId,
      year: yearNum,
      baseCalcul: baseCalcul as 'encaisse' | 'exigible',
      scope,
    });

    const totalLoyers = aggregated.biens.reduce((sum, bien) => sum + (bien.loyers || 0), 0);
    const totalCharges = aggregated.biens.reduce((sum, bien) => sum + (bien.charges || 0), 0);

    console.log(`[API Aggregate] org=${organizationId.slice(0, 8)} year=${yearNum} biens=${aggregated.biens.length} loyers=${totalLoyers} charges=${totalCharges}`);

    return NextResponse.json({
      biens: aggregated.biens || [],
      totaux: {
        loyers: totalLoyers,
        charges: totalCharges,
        nombreBiens: aggregated.biens.length,
      },
      year: yearNum,
    });
  } catch (error: any) {
    console.error('[API Aggregate] Erreur:', error);
    return NextResponse.json(
      { 
        error: 'Erreur lors de l\'agrégation des données',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const baseCalcul = searchParams.get('baseCalcul') || 'encaisse';

    const yearNum = year ? parseInt(year) : new Date().getFullYear();

    const aggregated = await FiscalAggregator.aggregate({
      organizationId,
      year: yearNum,
      baseCalcul: baseCalcul as 'encaisse' | 'exigible',
    });

    // Calculer les totaux simples pour l'encart
    const totalLoyers = aggregated.biens.reduce((sum, bien) => sum + (bien.loyers || 0), 0);
    const totalCharges = aggregated.biens.reduce((sum, bien) => sum + (bien.charges || 0), 0);

    return NextResponse.json({
      biens: aggregated.biens || [],
      totaux: {
        loyers: totalLoyers,
        charges: totalCharges,
        nombreBiens: aggregated.biens.length,
      },
      year: yearNum,
    });
  } catch (error: any) {
    console.error('[API Aggregate] Erreur:', error);
    return NextResponse.json(
      { 
        error: 'Erreur lors de l\'agrégation des données',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

