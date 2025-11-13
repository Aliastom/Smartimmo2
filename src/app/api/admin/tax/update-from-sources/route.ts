/**
 * API Routes - Admin - Mise à jour automatique depuis sources officielles
 * POST /api/admin/tax/update-from-sources
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TaxParamsUpdater } from '@/services/TaxParamsUpdater';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';

/**
 * POST /api/admin/tax/update-from-sources
 * Déclenche une mise à jour automatique des paramètres fiscaux depuis les sources officielles
 * 
 * Body: {
 *   year: number  // Année pour laquelle récupérer les paramètres
 * }
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    const body = await req.json();
    const { year } = body;

    if (!year) {
      return NextResponse.json(
        { error: 'Le champ "year" est requis' },
        { status: 400 }
      );
    }

    const updater = new TaxParamsUpdater();
    
    // Récupérer les paramètres depuis les sources officielles
    const result = await updater.fetchAndCreateDraft(year);

    return NextResponse.json({
      success: true,
      version: result.version,
      diff: result.diff,
      message: `Version draft "${result.version.code}" créée avec succès`,
    });
  } catch (error: any) {
    console.error('Error updating from sources:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour depuis les sources', details: error.message },
      { status: 500 }
    );
  }
}

