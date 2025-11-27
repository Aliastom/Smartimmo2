import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { previewAirbnbReservations } from '@/lib/services/airbnbImportService';
import { prisma } from '@/lib/prisma';

/**
 * API route pour prévisualiser l'import CSV Airbnb
 * POST /api/properties/[id]/airbnb/preview
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const propertyId = params.id;

    // Vérifier que le bien existe et appartient à l'organisation de l'utilisateur
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        organizationId: true,
        rentalMode: true,
        name: true,
      },
    });

    if (!property) {
      return NextResponse.json(
        { error: 'Bien introuvable' },
        { status: 404 }
      );
    }

    if (property.organizationId !== user.organizationId) {
      return NextResponse.json(
        { error: 'Accès non autorisé' },
        { status: 403 }
      );
    }

    // Vérifier que le bien est en mode Airbnb
    if (property.rentalMode !== 'SEASONAL_AIRBNB') {
      return NextResponse.json(
        { error: 'Ce bien n\'est pas configuré en mode Airbnb' },
        { status: 400 }
      );
    }

    // Récupérer le fichier CSV
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Aucun fichier fourni' },
        { status: 400 }
      );
    }

    // Vérifier le format
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      return NextResponse.json(
        { error: 'Le fichier doit être au format CSV' },
        { status: 400 }
      );
    }

    // Lire le contenu du fichier
    const csvContent = await file.text();

    // Prévisualiser les réservations
    const preview = previewAirbnbReservations(csvContent);

    return NextResponse.json({
      success: true,
      preview,
    });
  } catch (error) {
    console.error('Erreur lors de la prévisualisation:', error);
    return NextResponse.json(
      {
        error: 'Erreur lors de la prévisualisation',
        details: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}









