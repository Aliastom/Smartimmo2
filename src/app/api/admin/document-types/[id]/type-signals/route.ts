import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';

// GET /api/admin/document-types/[id]/type-signals - Récupérer les signaux d'un type

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

    const typeSignals = await prisma.typeSignal.findMany({
      where: {
        documentTypeId: id
      },
      include: {
        Signal: true
      },
      orderBy: {
        order: 'asc'
      }
    });

    return NextResponse.json({
      success: true,
      data: typeSignals.map(ts => ({
        id: ts.id,
        signalId: ts.signalId,
        code: ts.signal?.code || 'ORPHELIN',
        label: ts.signal?.label || 'Signal supprimé du catalogue',
        regex: ts.signal?.regex || '',
        flags: ts.signal?.flags || '',
        description: ts.signal?.description || 'Ce signal a été supprimé du catalogue global',
        weight: ts.weight,
        enabled: ts.enabled,
        order: ts.order,
        createdAt: ts.createdAt,
        updatedAt: ts.updatedAt,
        isOrphan: !ts.Signal // Signal orphelin si le signal n'existe plus
      }))
    });
  } catch (error) {
    console.error('Error fetching type signals:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la récupération des signaux' },
      { status: 500 }
    );
  }
}

// POST /api/admin/document-types/[id]/type-signals - Ajouter un signal à un type
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
    const { signalId, weight = 1.0, enabled = true } = body;

    if (!signalId) {
      return NextResponse.json(
        { success: false, error: 'Signal ID requis' },
        { status: 400 }
      );
    }

    // Vérifier que le signal existe
    const signal = await prisma.signal.findUnique({
      where: { id: signalId }
    });

    if (!signal) {
      return NextResponse.json(
        { success: false, error: 'Signal non trouvé' },
        { status: 404 }
      );
    }

    // Vérifier que la liaison n'existe pas déjà
    const existing = await prisma.typeSignal.findUnique({
      where: {
        documentTypeId_signalId: {
          documentTypeId: id,
          signalId: signalId
        }
      }
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Ce signal est déjà associé à ce type' },
        { status: 400 }
      );
    }

    // Obtenir l'ordre maximum actuel
    const maxOrder = await prisma.typeSignal.findFirst({
      where: { documentTypeId: id },
      orderBy: { order: 'desc' },
      select: { order: true }
    });

    // Créer la liaison
    const typeSignal = await prisma.typeSignal.create({
      data: {
        documentTypeId: id,
        signalId,
        weight,
        enabled,
        order: (maxOrder?.order || 0) + 1
      },
      include: {
        Signal: true
      }
    });

    // Invalider le cache
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

    return NextResponse.json({
      success: true,
      data: {
        id: typeSignal.id,
        signalId: typeSignal.signalId,
        code: typeSignal.Signal.code,
        label: typeSignal.Signal.label,
        weight: typeSignal.weight,
        enabled: typeSignal.enabled,
        order: typeSignal.order
      }
    });
  } catch (error) {
    console.error('Error adding signal to type:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de l\'ajout du signal' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/document-types/[id]/type-signals - Mettre à jour plusieurs signaux
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    const { id } = params;
    const body = await request.json();
    const { typeSignals } = body;

    if (!Array.isArray(typeSignals)) {
      return NextResponse.json(
        { success: false, error: 'typeSignals doit être un tableau' },
        { status: 400 }
      );
    }

    // Mettre à jour chaque signal
    const updates = typeSignals.map(ts =>
      prisma.typeSignal.update({
        where: { id: ts.id },
        data: {
          weight: ts.weight,
          enabled: ts.enabled,
          order: ts.order
        }
      })
    );

    await Promise.all(updates);

    // Invalider le cache
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

    return NextResponse.json({
      success: true,
      message: `${updates.length} signal(s) mis à jour`
    });
  } catch (error) {
    console.error('Error updating type signals:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la mise à jour des signaux' },
      { status: 500 }
    );
  }
}

