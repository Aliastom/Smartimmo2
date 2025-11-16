import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const { itemId } = params;

    console.log('[API] DELETE /api/uploads/staged-item:', itemId);

    // Vérifier que l'item existe et appartient à l'organisation
    const stagedItem = await prisma.uploadStagedItem.findFirst({
      where: { 
        id: itemId,
        organizationId
      }
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
