/**
 * API Route - Cron pour mise à jour automatique des paramètres fiscaux
 * GET /api/cron/tax-update
 * 
 * Sécurisé par CRON_SECRET pour empêcher les appels non autorisés
 * À configurer dans votre service de cron (Vercel Cron, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { TaxParamsUpdater } from '@/services/TaxParamsUpdater';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // ========== SÉCURITÉ : Vérifier le token de cron ==========
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'dev-secret-change-in-prod';

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Non autorisé - Token invalide' },
        { status: 401 }
      );
    }

    // ========== MISE À JOUR AUTOMATIQUE ==========

    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;

    console.log(`🔄 Cron tax-update démarré pour l'année ${nextYear}`);

    const updater = new TaxParamsUpdater();

    try {
      // Créer une version draft pour l'année prochaine
      const result = await updater.fetchAndCreateDraft(nextYear);

      console.log(`✅ Version draft ${result.version.code} créée avec succès`);
      console.log(`   ${result.diff.length} changement(s) détecté(s)`);

      return NextResponse.json({
        success: true,
        version: result.version,
        changes: result.diff.length,
        message: `Version draft ${result.version.code} créée avec succès`,
      });
    } catch (error: any) {
      console.error('❌ Erreur lors de la mise à jour automatique:', error);

      // En cas d'erreur réseau ou de parsing, ne pas crasher
      // On conserve la version active et on notifie l'admin
      return NextResponse.json(
        {
          success: false,
          error: 'Erreur lors de la récupération des sources officielles',
          details: error.message,
          fallback: 'Version active conservée',
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Erreur cron tax-update:', error);
    return NextResponse.json(
      { error: 'Erreur interne du cron', details: error.message },
      { status: 500 }
    );
  }
}

