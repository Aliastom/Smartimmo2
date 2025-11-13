import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const leaseId = params.id;

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

    // Vérifier que le bail est signé
    if (lease.status !== 'SIGNÉ') {
      return NextResponse.json({ 
        error: 'Le bail doit être signé pour être marqué comme actif' 
      }, { status: 400 });
    }

    // Vérifier les dates
    const today = new Date();
    const startDate = new Date(lease.startDate);
    
    if (today < startDate) {
      return NextResponse.json({ 
        error: `Le bail ne peut pas être activé avant le ${startDate.toLocaleDateString('fr-FR')}` 
      }, { status: 400 });
    }

    // Mettre à jour le statut à ACTIVE
    const updatedLease = await prisma.lease.update({
      where: { id: leaseId },
      data: {
        status: 'ACTIF',
        updatedAt: new Date()
      },
      include: {
        Tenant: true,
        Property: true
      }
    });

    return NextResponse.json({
      message: 'Bail marqué comme actif avec succès',
      lease: updatedLease
    });

  } catch (error) {
    console.error('Error marking lease as active:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'activation du bail' },
      { status: 500 }
    );
  }
}
