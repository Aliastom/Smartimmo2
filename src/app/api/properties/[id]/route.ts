import { NextRequest, NextResponse } from 'next/server';
import { PropertyRepo } from '@/lib/db/PropertyRepo';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { createPropertyServicePrisma } from '@/domain/services/propertyServiceFactory';
import { mapPropertyServiceErrorToHttpStatus } from '@/domain/services/propertyServiceHelpers';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

const updatePropertySchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['house', 'apartment', 'garage', 'commercial', 'land']).optional(),
  address: z.string().min(1).optional(),
  postalCode: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  surface: z.number().positive().optional(),
  rooms: z.number().int().positive().optional(),
  acquisitionDate: z.string().optional(),
  acquisitionPrice: z.number().positive().optional(),
  notaryFees: z.number().optional(),
  currentValue: z.number().optional(),
  status: z.string().optional(),
  occupation: z.string().optional(),
  notes: z.string().optional(),
  managementCompanyId: z.string().optional(),
  fiscalTypeId: z.string().optional(),
  fiscalRegimeId: z.string().optional(),
  rentalMode: z.enum(['LONG_TERM', 'SEASONAL_AIRBNB']).optional(),
  airbnbListingId: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const property = await PropertyRepo.findById(params.id, user.organizationId);
    
    if (!property) {
      return NextResponse.json(
        { error: 'Bien non trouvé' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(property);
  } catch (error) {
    console.error('Error fetching property:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du bien' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    
    // Validation minimale (shape)
    const validatedData = updatePropertySchema.parse(body);
    
    // Appel du service (toute la logique métier est dans PropertyService)
    const propertyService = createPropertyServicePrisma();
    const result = await propertyService.updateProperty(params.id, user.organizationId, {
      name: validatedData.name,
      type: validatedData.type,
      address: validatedData.address,
      postalCode: validatedData.postalCode,
      city: validatedData.city,
      surface: validatedData.surface,
      rooms: validatedData.rooms,
      acquisitionDate: validatedData.acquisitionDate,
      acquisitionPrice: validatedData.acquisitionPrice,
      notaryFees: validatedData.notaryFees,
      currentValue: validatedData.currentValue,
      status: validatedData.status,
      occupation: validatedData.occupation,
      notes: validatedData.notes,
      managementCompanyId: validatedData.managementCompanyId,
      fiscalTypeId: validatedData.fiscalTypeId,
      fiscalRegimeId: validatedData.fiscalRegimeId,
      rentalMode: validatedData.rentalMode,
      airbnbListingId: validatedData.airbnbListingId,
    });
    
    return NextResponse.json(result.property);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Error updating property:', error);
    
    if (error instanceof Error) {
      const status = mapPropertyServiceErrorToHttpStatus(error);
      return NextResponse.json(
        { error: error.message },
        { status }
      );
    }
    
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du bien' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const body = await request.json().catch(() => ({}));
    const mode = body.mode || 'archive'; // Par défaut : archiver
    const targetPropertyId = body.targetPropertyId;

    // Validation minimale du mode
    if (!['archive', 'reassign', 'cascade'].includes(mode)) {
      return NextResponse.json(
        { error: 'Mode de suppression invalide' },
        { status: 400 }
      );
    }

    // Appel du service (toute la logique métier est dans PropertyService)
    const propertyService = createPropertyServicePrisma();
    const result = await propertyService.deleteProperty(params.id, user.organizationId, {
      mode: mode as 'archive' | 'reassign' | 'cascade',
      targetPropertyId,
    });

    return NextResponse.json({ 
      message: mode === 'archive' 
        ? 'Bien archivé avec succès' 
        : mode === 'reassign'
        ? 'Bien transféré et supprimé avec succès'
        : 'Bien supprimé définitivement',
      mode: result.mode,
      stats: result.stats,
    });
  } catch (error: any) {
    console.error('Error deleting property:', error);

    if (error instanceof Error) {
      const status = mapPropertyServiceErrorToHttpStatus(error);
      return NextResponse.json(
        { 
          error: error.message,
          code: error.message.includes('des éléments sont liés') ? 'DEPENDENCY_EXISTS' : undefined
        },
        { status }
      );
    }
    
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du bien' },
      { status: 500 }
    );
  }
}