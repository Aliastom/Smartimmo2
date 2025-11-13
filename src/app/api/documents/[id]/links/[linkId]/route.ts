import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// DELETE /api/documents/[id]/links/[linkId] - Supprimer un lien spécifique
// linkId est maintenant au format "linkedType:linkedId"

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest, { params }: { params: { id: string; linkId: string } }) {
  try {
    const { id: documentId, linkId } = params;

    // Parser le linkId qui est au format "linkedType:linkedId"
    const [linkedType, linkedId] = linkId.split(':');
    
    if (!linkedType || !linkedId) {
      return NextResponse.json({ success: false, error: 'Format de lien invalide' }, { status: 400 });
    }

    // Vérifier que le lien existe et appartient au document
    const link = await prisma.documentLink.findFirst({
      where: {
        documentId: documentId,
        linkedType: linkedType,
        linkedId: linkedId,
      },
    });

    if (!link) {
      return NextResponse.json({ success: false, error: 'Lien non trouvé' }, { status: 404 });
    }

    // Vérifier s'il s'agit du dernier lien du document
    const totalLinks = await prisma.documentLink.count({
      where: {
        documentId: documentId,
      },
    });

    if (totalLinks === 1) {
      return NextResponse.json({ 
        success: false, 
        error: 'Impossible de supprimer le dernier lien. Un document doit toujours avoir au moins une liaison (Global ou spécifique).' 
      }, { status: 400 });
    }

    // Supprimer le lien en utilisant la clé primaire composite
    await prisma.documentLink.delete({
      where: {
        documentId_linkedType_linkedId: {
          documentId: documentId,
          linkedType: linkedType,
          linkedId: linkedId,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Lien supprimé avec succès',
    });
  } catch (error) {
    console.error('[DocumentLink] Erreur DELETE:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors de la suppression du lien',
        details: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
