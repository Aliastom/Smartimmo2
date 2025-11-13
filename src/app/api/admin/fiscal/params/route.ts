/**
 * API Route : Gestion des paramètres fiscaux (Admin)
 * GET /api/admin/fiscal/params - Liste toutes les versions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { TaxParamsService } from '@/services/tax/TaxParamsService';

export async function GET(request: NextRequest) {
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

