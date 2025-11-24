/**
 * API Route : Changelog des paramètres fiscaux
 * GET /api/admin/fiscal/params/changelog
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { TaxParamsService } from '@/services/tax/TaxParamsService';
import { protectRouteWithRole } from '@/lib/auth/protectRouteWithRole';

/**
 * GET /api/admin/fiscal/params/changelog - Liste le changelog des paramètres fiscaux
 * Accessible aux utilisateurs authentifiés (USER et ADMIN)
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Vérifier l'authentification (USER et ADMIN peuvent lire)
  const authError = await protectRouteWithRole('GET');
  if (authError) return authError;

  try {
    // TODO: Activer l'authentification en production
    // const session = await getServerSession();
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    // }
    
    const changelogs = await TaxParamsService.listChangelogs();
    
    return NextResponse.json(changelogs);
  } catch (error) {
    console.error('Erreur changelog:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du changelog' },
      { status: 500 }
    );
  }
}

