/**
 * API pour gérer la configuration des sources de scraping fiscal
 * GET  : Charger la configuration
 * POST : Sauvegarder la configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { loadSourcesConfig, saveSourcesConfig } from '@/services/tax/sources/configLoader';
import { DEFAULT_SOURCES } from '@/services/tax/sources/config';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';

// GET : Récupérer la configuration des sources

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    // TODO: Activer l'authentification en production
    // const session = await getServerSession();
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    // }

    const sources = await loadSourcesConfig();
    const isDefault = JSON.stringify(sources) === JSON.stringify(DEFAULT_SOURCES);

    return NextResponse.json({ 
      sources,
      isDefault 
    });

  } catch (error: any) {
    console.error('[API] Erreur chargement config sources:', error);
    return NextResponse.json(
      { error: 'Erreur lors du chargement de la configuration' },
      { status: 500 }
    );
  }
}

// POST : Sauvegarder la configuration des sources
export async function POST(req: NextRequest) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    // TODO: Activer l'authentification en production
    // const session = await getServerSession();
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    // }

    const body = await req.json();
    const { sources } = body;

    if (!sources || typeof sources !== 'object') {
      return NextResponse.json(
        { error: 'Format de données invalide' },
        { status: 400 }
      );
    }

    // TODO: Récupérer l'email depuis la session
    const updatedBy = 'system'; // session?.user?.email || 'system'
    const result = await saveSourcesConfig(sources, updatedBy);

    return NextResponse.json({
      success: true,
      count: result.count,
      message: `${result.count} source(s) sauvegardée(s)`
    });

  } catch (error: any) {
    console.error('[API] Erreur sauvegarde config sources:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la sauvegarde de la configuration' },
      { status: 500 }
    );
  }
}

