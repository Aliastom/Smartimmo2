import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Schéma de validation pour la mise à jour d'un bail

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

const updateLeaseSchema = z.object({
  status: z.enum(['BROUILLON', 'ENVOYÉ', 'SIGNÉ', 'ACTIF', 'RÉSILIÉ', 'ARCHIVÉ']).optional(),
  propertyId: z.string().min(1).optional(),
  tenantId: z.string().min(1).optional(),
  type: z.enum(['residential', 'commercial', 'garage']).optional(),
  furnishedType: z.enum(['vide', 'meuble', 'garage']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  rentAmount: z.number().positive().optional(),
  deposit: z.number().nonnegative().optional(),
  paymentDay: z.number().min(1).max(31).optional(),
  indexationType: z.enum(['none', 'insee', 'manual']).optional(),
  notes: z.string().optional(),
  signedPdfUrl: z.string().optional(),
  // Gestion déléguée - Granularité des charges
  chargesRecupMensuelles: z.number().min(0).optional(),
  chargesNonRecupMensuelles: z.number().min(0).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // TODO: Ajouter protection authentification
    const leaseId = params.id;
    const body = await request.json();

    // Validation des données
    const validatedData = updateLeaseSchema.parse(body);

    // Vérifier que le bail existe
    const existingLease = await prisma.lease.findUnique({
      where: { id: leaseId },
      include: {
        Property: true,
        Tenant: true,
        Transaction_Transaction_leaseIdToLease: true,
        Transaction_Transaction_bailIdToLease: true
      }
    });

    if (!existingLease) {
      return NextResponse.json({ error: 'Bail non trouvé' }, { status: 404 });
    }

    // Préparer les données de mise à jour
    const updateData: any = {
      ...validatedData,
      updatedAt: new Date()
    };

    // Convertir les dates si elles sont présentes
    if (validatedData.startDate) {
      updateData.startDate = new Date(validatedData.startDate);
    }
    
    // Gérer endDate : chaîne vide = null, sinon convertir
    if (validatedData.endDate !== undefined) {
      if (validatedData.endDate === '' || validatedData.endDate === null) {
        updateData.endDate = null;
      } else {
        updateData.endDate = new Date(validatedData.endDate);
      }
    }
    
    // Si le statut passe à SIGNÉ ou ACTIF et qu'il n'y a pas de endDate, calculer selon le type
    const isBecomingSignedOrActive = validatedData.status && 
      (validatedData.status === 'SIGNÉ' || validatedData.status === 'ACTIF') &&
      (existingLease.status === 'BROUILLON' || existingLease.status === 'ENVOYÉ');
    
    if (isBecomingSignedOrActive && !updateData.endDate && updateData.endDate !== false) {
      const startDate = updateData.startDate || existingLease.startDate;
      const calculatedEndDate = new Date(startDate);
      
      // Meublé = 1 an, Vide = 3 ans (durée légale minimale)
      const furnishedType = validatedData.furnishedType || existingLease.furnishedType;
      const duration = (furnishedType === 'meuble' || furnishedType === 'MEUBLE') ? 1 : 3;
      calculatedEndDate.setFullYear(calculatedEndDate.getFullYear() + duration);
      
      updateData.endDate = calculatedEndDate;
      console.log(`🗓️ Date de fin calculée automatiquement : ${calculatedEndDate.toISOString()} (${duration} an${duration > 1 ? 's' : ''} après le début - Type: ${furnishedType})`);
    }

    // Vérifications spécifiques selon le statut
    if (validatedData.status) {
      // Si on passe de ENVOYÉ à BROUILLON, c'est un retour arrière autorisé
      if (existingLease.status === 'ENVOYÉ' && validatedData.status === 'BROUILLON') {
        // Autoriser l'annulation de l'envoi
        console.log(`Annulation de l'envoi pour le bail ${leaseId}`);
      }
      // Si on passe de SIGNÉ à ENVOYÉ, c'est un retour arrière autorisé
      else if (existingLease.status === 'SIGNÉ' && validatedData.status === 'ENVOYÉ') {
        // Autoriser le retour en ENVOYÉ
        console.log(`Retour en ENVOYÉ pour le bail ${leaseId}`);
      }
      // Autres changements de statut nécessitent des vérifications
      else if (validatedData.status !== existingLease.status) {
        // Logique de validation des transitions selon les règles métier
        console.log(`Changement de statut de ${existingLease.status} vers ${validatedData.status} pour le bail ${leaseId}`);
      }
    }

    // Mettre à jour le bail
    const updatedLease = await prisma.lease.update({
      where: { id: leaseId },
      data: updateData,
      include: {
        Property: {
          select: { id: true, name: true, address: true }
        },
        Tenant: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: updatedLease,
      message: 'Bail mis à jour avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour du bail:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Données invalides',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Erreur lors de la mise à jour du bail'
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // TODO: Ajouter protection authentification
    const leaseId = params.id;

    // Vérifier que le bail existe
    const existingLease = await prisma.lease.findUnique({
      where: { id: leaseId },
      include: {
        Transaction_Transaction_leaseIdToLease: true,
        Transaction_Transaction_bailIdToLease: true
      }
    });

    if (!existingLease) {
      return NextResponse.json({ error: 'Bail non trouvé' }, { status: 404 });
    }

    // Protection contre la suppression de baux actifs
    // Un bail peut être supprimé si :
    // - Il est RÉSILIÉ (même avec des transactions, car c'est la fin du cycle de vie), OU
    // - Il n'est PAS ACTIF et n'a pas de transactions (BROUILLON, ENVOYÉ, etc.)
    if (existingLease.status === 'ACTIF') {
      return NextResponse.json({
        error: 'Ce bail est actif et ne peut pas être supprimé directement. Résiliez-le d\'abord.'
      }, { status: 409 });
    }
    
    const totalTransactions = (existingLease.Transaction_Transaction_leaseIdToLease?.length || 0) + (existingLease.Transaction_Transaction_bailIdToLease?.length || 0);
    if (totalTransactions > 0 && existingLease.status !== 'RÉSILIÉ') {
      return NextResponse.json({
        error: 'Ce bail ne peut pas être supprimé car il contient des transactions. Résiliez-le d\'abord.'
      }, { status: 409 });
    }

    // Supprimer le bail
    await prisma.lease.delete({
      where: { id: leaseId }
    });

    return NextResponse.json({
      success: true,
      message: 'Bail supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression du bail:', error);
    
    return NextResponse.json({
      error: 'Erreur lors de la suppression du bail'
    }, { status: 500 });
  }
}