/**
 * API Route - Validation des combinaisons fiscales
 * POST /api/fiscal/validate
 */

import { NextRequest, NextResponse } from 'next/server';
import { FiscalCombinationGuard } from '@/services/FiscalCombinationGuard';

/**
 * POST /api/fiscal/validate
 * Valide une combinaison de biens fiscaux
 * 
 * Body: {
 *   biens: Array<{ id: string, fiscalTypeId: string, fiscalRegimeId: string }>
 * }
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { biens } = body;

    if (!Array.isArray(biens)) {
      return NextResponse.json(
        { error: 'Le champ "biens" doit être un tableau' },
        { status: 400 }
      );
    }

    const guard = new FiscalCombinationGuard();
    const validation = await guard.validateCombination(biens);

    if (!validation.valid) {
      return NextResponse.json(
        {
          code: 'FISCAL_COMBINATION_INVALID',
          message: 'La combinaison fiscale n\'est pas valide',
          errors: validation.errors,
          warnings: validation.warnings,
        },
        { status: 400 }
      );
    }

    // Récupérer le résumé
    const summary = await guard.getSummary(biens);

    return NextResponse.json({
      valid: true,
      errors: [],
      warnings: validation.warnings,
      summary,
    });
  } catch (error: any) {
    console.error('Error validating fiscal combination:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la validation', details: error.message },
      { status: 500 }
    );
  }
}

