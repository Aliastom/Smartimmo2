import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PrismaClient } from '@prisma/client';
import { DocumentSignalSchema } from '@/types/document-types';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';



// GET /api/admin/document-types/[id]/signals - Récupérer les signaux d'un type

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    const { id } = params;

    const signals = await prisma.documentSignal.findMany({
      where: { documentTypeId: id },
      orderBy: { code: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: signals,
    });
  } catch (error) {
    console.error('Error fetching signals:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la récupération des signaux' },
      { status: 500 }
    );
  }
}

// POST /api/admin/document-types/[id]/signals - Créer/Mettre à jour les signaux
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    const { id } = params;
    const body = await request.json();
    const { signals } = body;

    if (!Array.isArray(signals)) {
      return NextResponse.json(
        { success: false, error: 'Les signaux doivent être un tableau' },
        { status: 400 }
      );
    }

    // Valider chaque signal
    const validatedSignals = signals.map((signal: any) => 
      DocumentSignalSchema.parse(signal)
    );

    // Supprimer tous les signaux existants
    await prisma.documentSignal.deleteMany({
      where: { documentTypeId: id },
    });

    // Créer les nouveaux signaux
    const createdSignals = await Promise.all(
      validatedSignals.map(signal =>
        prisma.documentSignal.create({
          data: {
            documentTypeId: id,
            code: signal.code,
            label: signal.label,
            weight: signal.weight,
            description: signal.description,
            type: signal.type,
            pattern: signal.pattern,
            flags: signal.flags,
          },
        })
      )
    );

    // Invalider le cache de configuration
    await invalidateConfigCache();

    return NextResponse.json({
      success: true,
      data: createdSignals,
    });
  } catch (error) {
    console.error('Error saving signals:', error);
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Données invalides', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Erreur lors de la sauvegarde des signaux' },
      { status: 500 }
    );
  }
}

// Fonction pour invalider le cache de configuration
async function invalidateConfigCache() {
  try {
    await prisma.appConfig.upsert({
      where: { key: 'document_config_version' },
      update: { 
        value: JSON.stringify({ version: Date.now() }),
        updatedAt: new Date(),
      },
      create: { 
        key: 'document_config_version',
        value: JSON.stringify({ version: Date.now() }),
        description: 'Version de la configuration des documents pour invalidation du cache',
      },
    });
  } catch (error) {
    console.error('Error invalidating config cache:', error);
  }
}