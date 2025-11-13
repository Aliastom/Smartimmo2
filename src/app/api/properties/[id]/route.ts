import { NextRequest, NextResponse } from 'next/server';
import { PropertyRepo } from '@/lib/db/PropertyRepo';
import { z } from 'zod';
import { deletePropertySmart, getPropertyStats } from '@/services/deletePropertySmart';

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
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const property = await PropertyRepo.findById(params.id);
    
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
    const body = await request.json();
    
    const validatedData = updatePropertySchema.parse(body);
    
    // Convertir la date si elle est fournie
    if (validatedData.acquisitionDate) {
      validatedData.acquisitionDate = new Date(validatedData.acquisitionDate);
    }
    
    // Convertir les chaînes vides en null pour les foreign keys optionnelles
    const sanitizedData: any = { ...validatedData };
    if ('managementCompanyId' in sanitizedData) {
      sanitizedData.managementCompanyId = sanitizedData.managementCompanyId || null;
    }
    if ('fiscalTypeId' in sanitizedData) {
      sanitizedData.fiscalTypeId = sanitizedData.fiscalTypeId || null;
    }
    if ('fiscalRegimeId' in sanitizedData) {
      sanitizedData.fiscalRegimeId = sanitizedData.fiscalRegimeId || null;
    }
    
    const property = await PropertyRepo.update(params.id, sanitizedData);
    
    return NextResponse.json(property);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Error updating property:', error);
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
    const body = await request.json().catch(() => ({}));
    const mode = body.mode || 'archive'; // Par défaut : archiver
    const targetPropertyId = body.targetPropertyId;

    // Validation du mode
    if (!['archive', 'reassign', 'cascade'].includes(mode)) {
      return NextResponse.json(
        { error: 'Mode de suppression invalide' },
        { status: 400 }
      );
    }

    // Validation du bien cible pour le mode reassign
    if (mode === 'reassign' && !targetPropertyId) {
      return NextResponse.json(
        { error: 'Bien cible requis pour le mode transfert' },
        { status: 400 }
      );
    }

    // Récupérer les stats avant suppression (pour le retour)
    const stats = await getPropertyStats(params.id);

    // Exécuter la suppression intelligente
    await deletePropertySmart({
      propertyId: params.id,
      mode,
      targetPropertyId,
    });

    return NextResponse.json({ 
      message: mode === 'archive' 
        ? 'Bien archivé avec succès' 
        : mode === 'reassign'
        ? 'Bien transféré et supprimé avec succès'
        : 'Bien supprimé définitivement',
      mode,
      stats,
    });
  } catch (error: any) {
    console.error('Error deleting property:', error);

    // Gestion des erreurs spécifiques
    if (error.message.includes('Bien non trouvé')) {
      return NextResponse.json(
        { error: 'Bien non trouvé' },
        { status: 404 }
      );
    }

    if (error.message.includes('des éléments sont liés')) {
      return NextResponse.json(
        { 
          error: 'Impossible de supprimer',
          message: error.message,
          code: 'DEPENDENCY_EXISTS'
        },
        { status: 409 }
      );
    }

    if (error.message.includes('Bien cible')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du bien' },
      { status: 500 }
    );
  }
}