/**
 * API Route: Paramètres fiscaux (lecture seule)
 * GET /api/fiscal/tax-params
 *
 * Retourne la dernière version publiée des paramètres fiscaux (ou fallback 2025).
 * Utilisé par le formulaire de simulation pour abattement salaires, etc.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { TaxParamsService } from '@/services/tax/TaxParamsService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const params = await TaxParamsService.getLatest();

    // Sérialisation : les fonctions (ex. irDecote.formula) sont omises par JSON
    return NextResponse.json({ params });
  } catch (error: unknown) {
    console.error('[API tax-params] Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur lors du chargement des paramètres fiscaux' },
      { status: 500 }
    );
  }
}
