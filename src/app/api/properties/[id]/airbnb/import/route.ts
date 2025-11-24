/**
 * API route pour l'import CSV Airbnb
 * POST /api/properties/[id]/airbnb/import
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { importAirbnbReservations } from '@/lib/services/airbnbImportService';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Vérifier l'authentification
    const user = await requireAuth();

    const propertyId = params.id;

    // 2. Vérifier que le bien existe et appartient à l'organisation
    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        organizationId: user.organizationId,
      },
    });

    if (!property) {
      return NextResponse.json(
        { success: false, error: 'Bien introuvable ou accès non autorisé' },
        { status: 404 }
      );
    }

    // 3. Vérifier que le bien est en mode Airbnb
    if (property.rentalMode !== 'SEASONAL_AIRBNB') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Ce bien n\'est pas configuré en mode Airbnb. Veuillez modifier le mode d\'exploitation du bien avant d\'importer des réservations.' 
        },
        { status: 400 }
      );
    }

    // 4. Récupérer le fichier CSV
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Fichier CSV manquant' },
        { status: 400 }
      );
    }

    // Vérifier le type de fichier
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      return NextResponse.json(
        { success: false, error: 'Le fichier doit être un CSV' },
        { status: 400 }
      );
    }

    // Vérifier la taille (max 10 Mo)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Fichier trop volumineux (max 10 Mo)' },
        { status: 400 }
      );
    }

    // 5. Lire le contenu du fichier
    const csvContent = await file.text();

    // 6. Importer les réservations
    const result = await importAirbnbReservations(
      propertyId,
      user.organizationId,
      csvContent
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Erreur lors de l\'import',
          details: result.errors,
          reservationsProcessed: result.reservationsProcessed,
          transactionsCreated: result.transactionsCreated,
          transactionsUpdated: result.transactionsUpdated,
        },
        { status: 400 }
      );
    }

    // 7. Retourner le résultat
    return NextResponse.json({
      success: true,
      message: `Import réussi : ${result.reservationsProcessed} réservation(s) traitée(s), ${result.transactionsCreated} transaction(s) créée(s), ${result.transactionsUpdated} transaction(s) mise(s) à jour.`,
      reservationsProcessed: result.reservationsProcessed,
      transactionsCreated: result.transactionsCreated,
      transactionsUpdated: result.transactionsUpdated,
      period: result.period,
    });
  } catch (error) {
    console.error('[API] Erreur lors de l\'import Airbnb:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue lors de l\'import',
      },
      { status: 500 }
    );
  }
}


