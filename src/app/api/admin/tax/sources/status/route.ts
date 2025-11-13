/**
 * API Route - Admin - Statut du job de scraping
 * GET /api/admin/tax/sources/status?jobId=xxx
 * 
 * Récupère le statut d'un job de scraping
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { taxScrapeWorker } from '@/services/tax/sources/TaxScrapeWorker';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';


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
    
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'Paramètre "jobId" requis' },
        { status: 400 }
      );
    }
    
    // Récupérer le statut du job
    const jobStatus = taxScrapeWorker.getJobStatus(jobId);
    
    if (!jobStatus) {
      return NextResponse.json(
        { error: 'Job introuvable' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(jobStatus);
    
  } catch (error: any) {
    console.error('Error getting job status:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du statut', details: error.message },
      { status: 500 }
    );
  }
}

