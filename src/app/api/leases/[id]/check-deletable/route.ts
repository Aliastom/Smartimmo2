import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const leaseId = params.id;

    // Vérifier si le bail existe
    const lease = await prisma.lease.findUnique({
      where: { id: leaseId }
    });

    if (!lease) {
      return NextResponse.json(
        { error: 'Bail non trouvé' },
        { status: 404 }
      );
    }

    // Vérifier s'il y a des transactions liées
    const transactionCount = await prisma.transaction.count({
      where: { leaseId }
    });

    // Un bail est supprimable si :
    // - Il est RÉSILIÉ (même avec des transactions, car c'est la fin du cycle de vie), OU
    // - Il n'est PAS ACTIF et n'a pas de transactions (BROUILLON, ENVOYÉ, etc.)
    const deletable = lease.status === 'RÉSILIÉ' || 
                      (lease.status !== 'ACTIF' && transactionCount === 0);
    
    let reason = null;
    if (!deletable) {
      if (lease.status === 'ACTIF') {
        reason = 'Ce bail est actif et ne peut pas être supprimé directement. Résiliez-le d\'abord.';
      } else if (transactionCount > 0) {
        reason = 'Ce bail contient des transactions et ne peut pas être supprimé. Résiliez-le d\'abord.';
      }
    }

    return NextResponse.json({
      deletable,
      reason,
      transactionCount
    });
  } catch (error) {
    console.error('Erreur lors de la vérification de la suppression:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

