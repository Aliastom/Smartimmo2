import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// DELETE /api/admin/document-types/[id]/type-signals/[typeSignalId] - Retirer un signal d'un type
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; typeSignalId: string } }
) {
  try {
    const { typeSignalId } = params;

    // Supprimer la liaison
    await prisma.typeSignal.delete({
      where: { id: typeSignalId }
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
      message: 'Signal retiré avec succès'
    });
  } catch (error) {
    console.error('Error removing signal from type:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la suppression du signal' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/document-types/[id]/type-signals/[typeSignalId] - Mettre à jour un signal
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; typeSignalId: string } }
) {
  try {
    const { typeSignalId } = params;
    const body = await request.json();
    const { weight, enabled, order } = body;

    const updateData: any = {};
    if (weight !== undefined) updateData.weight = weight;
    if (enabled !== undefined) updateData.enabled = enabled;
    if (order !== undefined) updateData.order = order;

    const typeSignal = await prisma.typeSignal.update({
      where: { id: typeSignalId },
      data: updateData,
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
    console.error('Error updating type signal:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la mise à jour du signal' },
      { status: 500 }
    );
  }
}

