import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const leaseId = params.id;

    // Récupérer le bail avec toutes les informations nécessaires
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

    // Retourner les données du bail pour la génération PDF côté client
    return NextResponse.json({
      message: 'Données du bail récupérées avec succès',
      lease: {
        id: lease.id,
        propertyName: lease.Property?.name,
        propertyAddress: lease.Property?.address,
        tenantName: `${lease.Tenant?.firstName} ${lease.Tenant?.lastName}`,
        tenantEmail: lease.Tenant?.email,
        rentAmount: lease.rentAmount,
        charges: (lease.chargesRecupMensuelles || 0) + (lease.chargesNonRecupMensuelles || 0),
        chargesRecupMensuelles: lease.chargesRecupMensuelles,
        chargesNonRecupMensuelles: lease.chargesNonRecupMensuelles,
        deposit: lease.deposit,
        startDate: lease.startDate,
        endDate: lease.endDate,
        type: lease.type,
        furnishedType: lease.furnishedType,
        paymentDay: lease.paymentDay,
        notes: lease.notes,
        status: lease.status,
        // Données complètes pour le PDF
        Property: lease.Property,
        Tenant: lease.Tenant
      }
    });

  } catch (error) {
    console.error('Error generating lease PDF data:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération des données PDF' },
      { status: 500 }
    );
  }
}
