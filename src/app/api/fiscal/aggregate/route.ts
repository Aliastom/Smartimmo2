/**
 * API Route: Agrégation des données fiscales
 * GET /api/fiscal/aggregate
 * 
 * Récupère les données SmartImmo agrégées (biens, revenus, charges)
 * sans effectuer de simulation complète.
 */

import { NextRequest, NextResponse } from 'next/server';
import { FiscalAggregator } from '@/services/tax/FiscalAggregator';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, year, baseCalcul = 'encaisse' } = body;

    // Validation
    if (!userId) {
      return NextResponse.json(
        { error: 'userId requis' },
        { status: 400 }
      );
    }

    const yearNum = year || new Date().getFullYear();

    // Agrégation des données SmartImmo
    const aggregated = await FiscalAggregator.aggregate({
      userId,
      year: yearNum,
      baseCalcul: baseCalcul as 'encaisse' | 'exigible',
    });

    // Calculer les totaux simples pour l'encart
    const totalLoyers = aggregated.biens.reduce((sum, bien) => sum + (bien.loyers || 0), 0);
    const totalCharges = aggregated.biens.reduce((sum, bien) => sum + (bien.charges || 0), 0);

    // Retourner uniquement les données agrégées
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
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const year = searchParams.get('year');
    const baseCalcul = searchParams.get('baseCalcul') || 'encaisse';

    if (!userId) {
      return NextResponse.json(
        { error: 'userId requis' },
        { status: 400 }
      );
    }

    const yearNum = year ? parseInt(year) : new Date().getFullYear();

    const aggregated = await FiscalAggregator.aggregate({
      userId,
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

