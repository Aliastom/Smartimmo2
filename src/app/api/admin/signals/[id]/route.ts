import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';

// GET /api/admin/signals/[id] - Récupérer un signal

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

    const signal = await prisma.signal.findUnique({
      where: { id },
      include: {
        TypeSignal: {
          include: {
            DocumentType: {
              select: {
                code: true,
                label: true
              }
            }
          }
        }
      }
    });

    if (!signal) {
      return NextResponse.json(
        { success: false, error: 'Signal non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...Signal,
        usages: signal.TypeSignal.length,
        documentTypes: signal.TypeSignal.map(ts => ({
          id: ts.documentTypeId,
          code: ts.DocumentType.code,
          label: ts.DocumentType.label,
          weight: ts.weight
        }))
      },
    });
  } catch (error) {
    console.error('Error fetching signal:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la récupération du signal' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/signals/[id] - Mettre à jour un signal
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
    const { code, label, regex, flags, description } = body;

    // Validation
    if (!code || !label || !regex) {
      return NextResponse.json(
        { success: false, error: 'Code, label et regex sont requis' },
        { status: 400 }
      );
    }

    // Vérifier si le signal est protégé
    const currentSignal = await prisma.signal.findUnique({
      where: { id }
    });

    if (!currentSignal) {
      return NextResponse.json(
        { success: false, error: 'Signal non trouvé' },
        { status: 404 }
      );
    }

    // Si protected, empêcher le rename du code
    if (currentSignal.protected && code !== currentSignal.code) {
      return NextResponse.json(
        { success: false, error: 'Impossible de renommer le code d\'un signal protégé. Utilisez "Cloner" pour créer une variante.' },
        { status: 403 }
      );
    }

    // Vérifier l'unicité du code (si changé)
    const existing = await prisma.signal.findFirst({
      where: { 
        code,
        id: { not: id }
      }
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Un signal avec le code "${code}" existe déjà` },
        { status: 400 }
      );
    }

    // Valider le regex
    try {
      new RegExp(regex, flags || 'iu');
    } catch (error) {
      return NextResponse.json(
        { success: false, error: `Pattern regex invalide: ${error instanceof Error ? error.message : 'Erreur inconnue'}` },
        { status: 400 }
      );
    }

    // Vérifier si le signal est utilisé
    const usageCount = await prisma.typeSignal.count({
      where: { signalId: id }
    });

    // Mettre à jour le signal
    const signal = await prisma.signal.update({
      where: { id },
      data: {
        code,
        label,
        regex,
        flags: flags || 'iu',
        description
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
      data: signal,
      warning: usageCount > 0 ? `Ce signal est utilisé par ${usageCount} type(s) de document` : undefined
    });
  } catch (error) {
    console.error('Error updating signal:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la mise à jour du signal' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/signals/[id] - Supprimer un signal (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    const { id } = params;

    // Vérifier si le signal est protégé
    const signal = await prisma.signal.findUnique({
      where: { id }
    });

    if (!signal) {
      return NextResponse.json(
        { success: false, error: 'Signal non trouvé' },
        { status: 404 }
      );
    }

    if (signal.protected) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Impossible de supprimer un signal protégé. Utilisez "Cloner" pour créer une variante personnalisée.',
        },
        { status: 403 }
      );
    }

    // Vérifier si le signal est utilisé
    const usageCount = await prisma.typeSignal.count({
      where: { signalId: id }
    });

    if (usageCount > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Ce signal est utilisé par ${usageCount} type(s) de document. Veuillez d'abord le retirer de ces types ou proposer un signal de remplacement.`,
          usages: usageCount
        },
        { status: 400 }
      );
    }

    // Soft delete
    const deletedSignal = await prisma.signal.update({
      where: { id },
      data: {
        deletedAt: new Date()
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
      data: deletedSignal,
    });
  } catch (error) {
    console.error('Error deleting signal:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la suppression du signal' },
      { status: 500 }
    );
  }
}

