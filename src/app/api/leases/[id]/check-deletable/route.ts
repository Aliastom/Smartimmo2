import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

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
      where: {
        organizationId: lease.organizationId,
        OR: [{ leaseId }, { bailId: leaseId }],
      },
    });

    // Un bail est supprimable seulement s'il n'est pas actif
    // ET qu'il n'a aucune transaction liée.
    const deletable = lease.status !== 'ACTIF' && transactionCount === 0;
    
    let reason = null;
    if (!deletable) {
      if (lease.status === 'ACTIF') {
        reason = 'Ce bail est actif et ne peut pas être supprimé directement. Résiliez-le d\'abord.';
      } else if (transactionCount > 0) {
        reason = 'Ce bail contient des transactions et ne peut pas être supprimé.';
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

