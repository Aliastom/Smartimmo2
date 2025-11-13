import { NextRequest, NextResponse } from 'next/server';
import { TenantRepo, TenantFilters } from '@/lib/db/TenantRepo';
import { z } from 'zod';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

const createTenantSchema = z.object({
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  email: z.string().email('Email invalide'),
  phone: z.string().optional().refine((val) => {
    if (!val) return true; // Optionnel
    // Accepter les formats : +33..., 06..., 01..., etc.
    const phoneRegex = /^[\+]?[0-9\s\-\(\)]{8,20}$/;
    return phoneRegex.test(val);
  }, 'Format de téléphone invalide (ex: +33612345678 ou 0612345678)'),
  birthDate: z.string().optional(),
  nationality: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  occupation: z.string().optional(),
  employer: z.string().optional(),
  monthlyIncome: z.number().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional().refine((val) => {
    if (!val) return true; // Optionnel
    const phoneRegex = /^[\+]?[0-9\s\-\(\)]{8,20}$/;
    return phoneRegex.test(val);
  }, 'Format de téléphone d\'urgence invalide'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const filters: TenantFilters = {
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10,
      sortBy: (searchParams.get('sortBy') as any) || 'lastName',
      sortOrder: (searchParams.get('sortOrder') as any) || 'asc'
    };

    const result = await TenantRepo.findMany(filters);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching tenants:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des locataires' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const validatedData = createTenantSchema.parse(body);
    
    // Exclure l'ID si présent (création, pas mise à jour)
    const { id, ...dataWithoutId } = validatedData as any;
    
    const tenant = await TenantRepo.create({
      ...dataWithoutId,
      birthDate: validatedData.birthDate ? new Date(validatedData.birthDate) : undefined,
      tags: validatedData.tags ? JSON.stringify(validatedData.tags) : undefined
    });
    
    return NextResponse.json(tenant, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Error creating tenant:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du locataire' },
      { status: 500 }
    );
  }
}