import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const { sessionId } = params;

    // Vérifier que la session existe et appartient à l'organisation
    const uploadSession = await prisma.uploadSession.findFirst({
      where: { 
        id: sessionId,
        organizationId
      },
      include: {
        Document: {
          include: {
            DocumentType: true
          }
        },
        UploadStagedItem: {
          include: {
            Document: {
              include: {
                DocumentType: {
                  select: {
                    id: true,
                    label: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!uploadSession) {
      return NextResponse.json(
        { success: false, error: 'Session d\'upload introuvable' },
        { status: 404 }
      );
    }

    // Vérifier si la session est expirée
    if (uploadSession.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Session d\'upload expirée' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      session: {
        id: uploadSession.id,
        createdAt: uploadSession.createdAt,
        expiresAt: uploadSession.expiresAt
      },
      // Documents brouillons (drafts)
      drafts: uploadSession.Document.map(doc => ({
        id: doc.id,
        name: doc.filenameOriginal,
        status: doc.status,
        type: doc.DocumentType?.label || 'Non classé',
        typeId: doc.documentTypeId,
        size: doc.size,
        mime: doc.mime,
        intendedContext: {
          type: doc.intendedContextType,
          tempKey: doc.intendedContextTempKey
        },
        uploadedAt: doc.uploadedAt
      })),
      // Liens vers documents existants
      links: uploadSession.UploadStagedItem.map(item => ({
        id: item.id,
        kind: item.kind,
        existingDocument: item.Document ? {
          id: item.Document.id,
          fileName: item.Document.filenameOriginal,
          typeLabel: item.Document.DocumentType?.label || 'Type inconnu',
          size: item.Document.size,
          uploadedAt: item.Document.uploadedAt
        } : null,
        intendedContext: {
          type: item.intendedContextType,
          tempKey: item.intendedContextTempKey,
          refId: item.intendedRefId
        },
        createdAt: item.createdAt
      }))
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de la session:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la récupération de la session' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const { sessionId } = params;

    console.log('[API] Suppression de la session:', sessionId);

    // Vérifier que la session appartient à l'organisation
    const session = await prisma.uploadSession.findFirst({
      where: { id: sessionId, organizationId },
      select: { id: true },
    });
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session non trouvée ou inaccessible' },
        { status: 403 }
      );
    }

    // D'abord, supprimer tous les documents brouillons de cette session
    const documentsToDelete = await prisma.document.findMany({
      where: {
        uploadSessionId: sessionId,
        status: 'draft',
        organizationId
      }
    });

    console.log(`[API] ${documentsToDelete.length} documents brouillons trouvés pour suppression`);

    // Supprimer les fichiers physiques et les entrées de base
    for (const doc of documentsToDelete) {
      try {
        // Supprimer le fichier physique s'il existe
        if (doc.storagePath) {
          const fs = require('fs').promises;
          const path = require('path');
          const fullPath = path.join(process.cwd(), 'storage', 'tmp', doc.storagePath);
          try {
            await fs.unlink(fullPath);
            console.log(`[API] Fichier physique supprimé: ${fullPath}`);
          } catch (fileError) {
            console.warn(`[API] Impossible de supprimer le fichier: ${fullPath}`, fileError);
          }
        }
        
        // Supprimer l'entrée de base
        await prisma.document.delete({
          where: { id: doc.id }
        });
        console.log(`[API] Document brouillon supprimé de la base: ${doc.id}`);
      } catch (docError) {
        console.error(`[API] Erreur lors de la suppression du document ${doc.id}:`, docError);
      }
    }

    // Enfin, supprimer la session
    await prisma.uploadSession.delete({
      where: { id: sessionId }
    });

    console.log(`[API] Session supprimée avec succès: ${sessionId}`);

    return NextResponse.json({
      success: true,
      message: 'Session d\'upload et documents brouillons supprimés'
    });
  } catch (error) {
    console.error('Erreur lors de la suppression de la session:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la suppression de la session' },
      { status: 500 }
    );
  }
}
