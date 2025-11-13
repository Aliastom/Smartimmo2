/**
 * API Route : Changelog des paramètres fiscaux
 * GET /api/admin/fiscal/params/changelog
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { TaxParamsService } from '@/services/tax/TaxParamsService';

export async function GET(request: NextRequest) {
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

