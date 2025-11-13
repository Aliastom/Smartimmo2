import { NextRequest, NextResponse } from 'next/server';
import { hardDeleteDocument } from '@/lib/docsSimple';

/**
 * DELETE /api/documents/[id]/hard-delete
 * Suppression définitive (hard delete) d'un document avec toutes ses liaisons
 * 
 * Cette route implémente la logique de suppression simple :
 * - Supprime le document de la base de données
 * - Supprime automatiquement toutes les liaisons (cascade)
 * - Supprime le fichier physique
 * 
 * Note : La modal d'alerte doit être gérée côté client AVANT d'appeler cette route
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documentId = params.id;

    if (!documentId) {
      return NextResponse.json(
        { error: 'ID de document manquant' },
        { status: 400 }
      );
    }

    // Suppression hard delete (supprime le document + toutes les liaisons + fichier physique)
    await hardDeleteDocument(documentId);

    return NextResponse.json({ 
      success: true,
      message: 'Document supprimé définitivement'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression du document:', error);
    
    // Si le document n'existe pas
    if (error instanceof Error && error.message.includes('non trouvé')) {
      return NextResponse.json(
        { error: 'Document non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Erreur lors de la suppression du document' },
      { status: 500 }
    );
  }
}

