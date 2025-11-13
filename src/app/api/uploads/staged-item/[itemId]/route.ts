import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const { itemId } = params;

    console.log('[API] DELETE /api/uploads/staged-item:', itemId);

    // Vérifier que l'item existe
    const stagedItem = await prisma.uploadStagedItem.findUnique({
      where: { id: itemId }
    });

    if (!stagedItem) {
      return NextResponse.json(
        { success: false, error: 'Staged item introuvable' },
        { status: 404 }
      );
    }

    // Supprimer l'item
    await prisma.uploadStagedItem.delete({
      where: { id: itemId }
    });

    console.log('[API] StagedItem supprimé:', itemId);

    return NextResponse.json({
      success: true,
      message: 'Staged item supprimé'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression du staged item:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la suppression' },
      { status: 500 }
    );
  }
}
