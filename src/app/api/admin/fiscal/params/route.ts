/**
 * API Route : Gestion des paramètres fiscaux (Admin)
 * GET /api/admin/fiscal/params - Liste toutes les versions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { TaxParamsService } from '@/services/tax/TaxParamsService';
import { protectRouteWithRole } from '@/lib/auth/protectRouteWithRole';

/**
 * GET /api/admin/fiscal/params - Liste toutes les versions
 * Accessible aux utilisateurs authentifiés (USER et ADMIN)
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Vérifier l'authentification (USER et ADMIN peuvent lire)
  const authError = await protectRouteWithRole('GET');
  if (authError) return authError;

  try {
    // Vérifier l'authentification et les permissions admin
    // TODO: Activer l'authentification en production
    // const session = await getServerSession();
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    // }
    
    // TODO: Vérifier le rôle admin
    // if (session.user.role !== 'admin') {
    //   return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    // }
    
    // Récupérer toutes les versions
    const versions = await TaxParamsService.listVersions();
    
    return NextResponse.json(versions);
  } catch (error) {
    console.error('Erreur liste paramètres fiscaux:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des paramètres fiscaux' },
      { status: 500 }
    );
  }
}

