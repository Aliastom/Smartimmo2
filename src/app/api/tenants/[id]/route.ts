import { NextRequest, NextResponse } from 'next/server';
import { TenantRepo } from '@/lib/db/TenantRepo';
import { z } from 'zod';

const updateTenantSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
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
  emergencyPhone: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenant = await TenantRepo.findById(params.id);
    
    if (!tenant) {
      return NextResponse.json(
        { error: 'Locataire non trouvé' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(tenant);
  } catch (error) {
    console.error('Error fetching tenant:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du locataire' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    
    const validatedData = updateTenantSchema.parse(body);
    
    // Convertir la date si elle est fournie
    if (validatedData.birthDate) {
      validatedData.birthDate = new Date(validatedData.birthDate);
    }
    
    // Convertir les tags en string si c'est un array
    if (validatedData.tags && Array.isArray(validatedData.tags)) {
      validatedData.tags = JSON.stringify(validatedData.tags);
    }
    
    const tenant = await TenantRepo.update(params.id, validatedData);
    
    return NextResponse.json(tenant);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Error updating tenant:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du locataire' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await TenantRepo.delete(params.id);
    
    return NextResponse.json({ message: 'Locataire supprimé avec succès' });
  } catch (error: any) {
    if (error.message.includes('Cannot delete tenant')) {
      return NextResponse.json(
        { 
          error: 'Impossible de supprimer ce locataire',
          message: error.message,
          code: 'DEPENDENCY_EXISTS'
        },
        { status: 409 }
      );
    }
    
    console.error('Error deleting tenant:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du locataire' },
      { status: 500 }
    );
  }
}