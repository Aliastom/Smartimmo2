import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const indexRentSchema = z.object({
  newRentAmount: z.number().positive('Le nouveau loyer doit être positif'),
  effectiveDate: z.string().min(1, 'La date d\'effet est requise'),
  indexType: z.enum(['IRL', 'ILAT', 'ICC', 'MANUAL']).optional(),
  indexValue: z.number().optional(),
  indexDate: z.string().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const leaseId = params.id;
    const body = await request.json();
    
    // Valider les données
    const validatedData = indexRentSchema.parse(body);
    
    // Vérifier que le bail existe et appartient à l'organisation
    const lease = await prisma.lease.findFirst({
      where: {
        id: leaseId,
        organizationId: user.organizationId
      }
    });
    
    if (!lease) {
      return NextResponse.json(
        { error: 'Bail non trouvé' },
        { status: 404 }
      );
    }
    
    // Créer l'enregistrement de réindexation
    const indexation = await prisma.rentIndexation.create({
      data: {
        leaseId: lease.id,
        organizationId: user.organizationId,
        previousRentAmount: lease.rentAmount,
        newRentAmount: validatedData.newRentAmount,
        effectiveDate: new Date(validatedData.effectiveDate),
        indexType: validatedData.indexType || null,
        indexValue: validatedData.indexValue || null,
        indexDate: validatedData.indexDate ? new Date(validatedData.indexDate) : null,
        reason: validatedData.reason || null,
        notes: validatedData.notes || null,
        createdBy: user.id
      }
    });
    
    // Mettre à jour le loyer du bail (sans modifier les autres champs)
    await prisma.lease.update({
      where: { id: lease.id },
      data: {
        rentAmount: validatedData.newRentAmount,
        updatedAt: new Date()
      }
    });
    
    return NextResponse.json({
      message: 'Réindexation effectuée avec succès',
      indexation: {
        id: indexation.id,
        previousRentAmount: indexation.previousRentAmount,
        newRentAmount: indexation.newRentAmount,
        effectiveDate: indexation.effectiveDate,
        indexType: indexation.indexType,
        createdAt: indexation.createdAt
      },
      lease: {
        id: lease.id,
        rentAmount: validatedData.newRentAmount
      }
    });
    
  } catch (error) {
    console.error('Error indexing rent:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Erreur lors de la réindexation' },
      { status: 500 }
    );
  }
}

// GET : Récupérer l'historique des réindexations pour un bail
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const leaseId = params.id;
    
    // Vérifier que le bail existe et appartient à l'organisation
    const lease = await prisma.lease.findFirst({
      where: {
        id: leaseId,
        organizationId: user.organizationId
      }
    });
    
    if (!lease) {
      return NextResponse.json(
        { error: 'Bail non trouvé' },
        { status: 404 }
      );
    }
    
    // Récupérer l'historique des réindexations
    const indexations = await prisma.rentIndexation.findMany({
      where: {
        leaseId: lease.id,
        organizationId: user.organizationId
      },
      orderBy: {
        effectiveDate: 'desc'
      }
    });
    
    return NextResponse.json({
      indexations: indexations.map(indexation => ({
        id: indexation.id,
        previousRentAmount: indexation.previousRentAmount,
        newRentAmount: indexation.newRentAmount,
        effectiveDate: indexation.effectiveDate,
        indexType: indexation.indexType,
        indexValue: indexation.indexValue,
        indexDate: indexation.indexDate,
        reason: indexation.reason,
        notes: indexation.notes,
        createdAt: indexation.createdAt
      }))
    });
    
  } catch (error) {
    console.error('Error fetching rent indexations:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de l\'historique' },
      { status: 500 }
    );
  }
}

