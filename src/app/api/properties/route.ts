import { NextRequest, NextResponse } from 'next/server';
import { PropertyRepo, PropertyFilters } from '@/lib/db/PropertyRepo';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { createPropertyServicePrisma } from '@/domain/services/propertyServiceFactory';
import { mapPropertyServiceErrorToHttpStatus } from '@/domain/services/propertyServiceHelpers';

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

const createPropertySchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  type: z.enum(['house', 'apartment', 'garage', 'commercial', 'land']),
  address: z.string().min(1, 'L\'adresse est requise'),
  postalCode: z.string().min(1, 'Le code postal est requis'),
  city: z.string().min(1, 'La ville est requise'),
  surface: z.number().positive('La surface doit être positive'),
  rooms: z.number().int().positive('Le nombre de pièces doit être positif'),
  acquisitionDate: z.string().min(1, 'La date d\'acquisition est requise'),
  acquisitionPrice: z.number().positive('Le prix d\'acquisition doit être positif'),
  notaryFees: z.number().min(0, 'Les frais de notaire doivent être positifs'),
  currentValue: z.number().min(0, 'La valeur actuelle doit être positive'),
  status: z.string().optional(),
  occupation: z.string().optional(),
  notes: z.string().optional(),
  managementCompanyId: z.string().optional(),
  fiscalTypeId: z.string().optional(),
  fiscalRegimeId: z.string().optional(),
  rentalMode: z.enum(['LONG_TERM', 'SEASONAL_AIRBNB']).optional(),
  airbnbListingId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    
    const filters: PropertyFilters = {
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      type: searchParams.get('type') || undefined,
      city: searchParams.get('city') || undefined,
      includeArchived: searchParams.get('includeArchived') === 'true', // ⚠️ CRITIQUE: Respecter le paramètre includeArchived
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10,
      sortBy: (searchParams.get('sortBy') as any) || 'name',
      sortOrder: (searchParams.get('sortOrder') as any) || 'asc'
    };

    const result = await PropertyRepo.findMany(filters, user.organizationId);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching properties:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des biens' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    
    // Validation minimale (shape)
    const validatedData = createPropertySchema.parse(body);
    
    // Exclure l'ID si présent (création, pas mise à jour)
    const { id, ...dataWithoutId } = validatedData as any;
    
    // Appel du service (toute la logique métier est dans PropertyService)
    const propertyService = createPropertyServicePrisma();
    const result = await propertyService.createProperty({
      organizationId: user.organizationId,
      name: dataWithoutId.name,
      type: dataWithoutId.type,
      address: dataWithoutId.address,
      postalCode: dataWithoutId.postalCode,
      city: dataWithoutId.city,
      surface: dataWithoutId.surface,
      rooms: dataWithoutId.rooms,
      acquisitionDate: dataWithoutId.acquisitionDate,
      acquisitionPrice: dataWithoutId.acquisitionPrice,
      notaryFees: dataWithoutId.notaryFees,
      currentValue: dataWithoutId.currentValue,
      status: dataWithoutId.status,
      occupation: dataWithoutId.occupation,
      notes: dataWithoutId.notes,
      managementCompanyId: dataWithoutId.managementCompanyId,
      fiscalTypeId: dataWithoutId.fiscalTypeId,
      fiscalRegimeId: dataWithoutId.fiscalRegimeId,
      rentalMode: dataWithoutId.rentalMode,
      airbnbListingId: dataWithoutId.airbnbListingId,
    });
    
    return NextResponse.json(result.property, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Error creating property:', error);
    
    if (error instanceof Error) {
      const status = mapPropertyServiceErrorToHttpStatus(error);
      return NextResponse.json(
        { error: error.message },
        { status }
      );
    }
    
    return NextResponse.json(
      { error: 'Erreur lors de la création du bien' },
      { status: 500 }
    );
  }
}