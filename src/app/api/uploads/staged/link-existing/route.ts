import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { uploadSessionId, existingDocumentId, context } = body;

    console.log('[API] POST /api/uploads/staged/link-existing:', {
      uploadSessionId,
      existingDocumentId,
      context
    });

    if (!uploadSessionId || !existingDocumentId || !context) {
      return NextResponse.json(
        { success: false, error: 'uploadSessionId, existingDocumentId et context requis' },
        { status: 400 }
      );
    }

    // Vérifier que la session d'upload existe
    const uploadSession = await prisma.uploadSession.findFirst({
      where: {
        id: uploadSessionId,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (!uploadSession) {
      return NextResponse.json(
        { success: false, error: 'Session d\'upload invalide ou expirée' },
        { status: 400 }
      );
    }

    // Vérifier que le document existant existe et est actif
    const existingDocument = await prisma.document.findFirst({
      where: {
        id: existingDocumentId,
        status: 'active'
      }
    });

    if (!existingDocument) {
      return NextResponse.json(
        { success: false, error: 'Document existant introuvable ou inactif' },
        { status: 404 }
      );
    }

    // Créer l'UploadStagedItem de type 'link'
    const stagedItem = await prisma.uploadStagedItem.create({
      data: {
        uploadSessionId,
        kind: 'link',
        existingDocumentId,
        intendedContextType: context.type,
        intendedContextTempKey: context.tempKey,
        intendedRefId: context.refId
      },
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
    });

    console.log('[API] StagedItem de lien créé:', stagedItem.id);

    return NextResponse.json({
      success: true,
      itemId: stagedItem.id,
      item: {
        id: stagedItem.id,
        kind: 'link',
        existingDocument: {
          id: stagedItem.Document.id,
          fileName: stagedItem.Document.filenameOriginal,
          typeLabel: stagedItem.Document.DocumentType?.label || 'Type inconnu',
          size: stagedItem.Document.size,
          uploadedAt: stagedItem.Document.uploadedAt
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la création du lien vers document existant:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la création du lien' },
      { status: 500 }
    );
  }
}
