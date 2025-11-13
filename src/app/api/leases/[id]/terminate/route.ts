import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const leaseId = params.id;
    const body = await request.json().catch(() => ({}));
    const { reason, terminationDate } = body;

    // Vérifier que le bail existe
    const lease = await prisma.lease.findUnique({
      where: { id: leaseId },
      include: { 
        Tenant: true, 
        Property: true 
      }
    });

    if (!lease) {
      return NextResponse.json({ error: 'Bail non trouvé' }, { status: 404 });
    }

    // Vérifier que le bail n'est pas déjà résilié
    if (lease.status === 'RÉSILIÉ') {
      return NextResponse.json({ 
        error: 'Ce bail est déjà résilié' 
      }, { status: 400 });
    }

    // Déterminer la date de résiliation
    const effectiveTerminationDate = terminationDate ? new Date(terminationDate) : new Date();

    // Mettre à jour le bail
    const updatedLease = await prisma.lease.update({
      where: { id: leaseId },
      data: {
        status: 'RÉSILIÉ',
        endDate: effectiveTerminationDate,
        updatedAt: new Date(),
        // Optionnel : ajouter la raison de résiliation dans les notes
        notes: reason ? `${lease.notes || ''}\n\nRésilié le ${effectiveTerminationDate.toLocaleDateString('fr-FR')}${reason ? ` - Raison: ${reason}` : ''}`.trim() : lease.notes
      },
      include: {
        Tenant: true,
        Property: true
      }
    });

    return NextResponse.json({
      message: 'Bail résilié avec succès',
      lease: updatedLease
    });

  } catch (error) {
    console.error('Error terminating lease:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la résiliation du bail' },
      { status: 500 }
    );
  }
}
