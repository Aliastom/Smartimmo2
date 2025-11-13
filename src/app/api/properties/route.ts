import { NextRequest, NextResponse } from 'next/server';
import { PropertyRepo, PropertyFilters } from '@/lib/db/PropertyRepo';
import { z } from 'zod';


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
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const filters: PropertyFilters = {
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      type: searchParams.get('type') || undefined,
      city: searchParams.get('city') || undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10,
      sortBy: (searchParams.get('sortBy') as any) || 'name',
      sortOrder: (searchParams.get('sortOrder') as any) || 'asc'
    };

    const result = await PropertyRepo.findMany(filters);
    
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
    const body = await request.json();
    const validatedData = createPropertySchema.parse(body);
    
    // Exclure l'ID si présent (création, pas mise à jour)
    const { id, ...dataWithoutId } = validatedData as any;
    
    // Convertir les chaînes vides en null pour les foreign keys optionnelles
    const sanitizedData = {
      ...dataWithoutId,
      acquisitionDate: new Date(validatedData.acquisitionDate),
      managementCompanyId: dataWithoutId.managementCompanyId || null,
      fiscalTypeId: dataWithoutId.fiscalTypeId || null,
      fiscalRegimeId: dataWithoutId.fiscalRegimeId || null,
    };
    
    const property = await PropertyRepo.create(sanitizedData);
    
    return NextResponse.json(property, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Error creating property:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du bien' },
      { status: 500 }
    );
  }
}