/**
 * API Route : Rafraîchir les paramètres fiscaux
 * POST /api/admin/fiscal/params/refresh
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    // TODO: Activer l'authentification en production
    // const session = await getServerSession();
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    // }
    
    // TODO: Vérifier le rôle admin
    
    // En production, ceci déclencherait une mise à jour depuis les sources officielles
    // Pour l'instant, on retourne un succès simulé
    
    console.log('🔄 Mise à jour des barèmes fiscaux demandée');
    
    return NextResponse.json({
      success: true,
      message: 'Barèmes fiscaux à jour',
    });
  } catch (error) {
    console.error('Erreur refresh:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour' },
      { status: 500 }
    );
  }
}

