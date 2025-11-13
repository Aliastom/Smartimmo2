/**
 * API Route - Admin - Mise à jour depuis sources officielles
 * POST /api/admin/tax/sources/update
 * 
 * Lance un job de scraping des sources fiscales officielles
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { taxScrapeWorker } from '@/services/tax/sources/TaxScrapeWorker';

export async function POST(req: NextRequest) {
  try {
    // TODO: Activer l'authentification en production
    // const session = await getServerSession();
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    // }
    
    // TODO: Vérifier le rôle admin_fiscal
    // if (!session.user.roles?.includes('admin_fiscal')) {
    //   return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    // }
    
    const body = await req.json();
    const { year } = body;
    
    // Validation
    if (!year || typeof year !== 'number') {
      return NextResponse.json(
        { error: 'Paramètre "year" requis (nombre)' },
        { status: 400 }
      );
    }
    
    if (year < 2020 || year > 2030) {
      return NextResponse.json(
        { error: 'Année invalide (doit être entre 2020 et 2030)' },
        { status: 400 }
      );
    }
    
    // Lancer le job
    const userId = 'system'; // TODO: Utiliser session.user.id
    const jobId = await taxScrapeWorker.startJob(year, userId);
    
    return NextResponse.json({
      success: true,
      jobId,
      message: `Job de scraping lancé pour l'année ${year}`
    });
    
  } catch (error: any) {
    console.error('Error starting scrape job:', error);
    return NextResponse.json(
      { error: 'Erreur lors du lancement du job', details: error.message },
      { status: 500 }
    );
  }
}

