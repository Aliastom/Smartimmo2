import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStorageService } from '@/services/storage.service';
import { requireAuth } from '@/lib/auth/getCurrentUser';

/**
 * GET /api/documents/[id]/file
 * Streame le fichier d'un document depuis le stockage
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const documentId = params.id;

    if (!documentId) {
      return NextResponse.json(
        { success: false, error: 'ID de document manquant' },
        { status: 400 }
      );
    }

    // Récupérer le document
    const document = await prisma.document.findFirst({
      where: { id: documentId, organizationId: user.organizationId },
      select: {
        id: true,
        filenameOriginal: true,
        fileName: true,
        mime: true,
        bucketKey: true,
        url: true,
        deletedAt: true,
      }
    });

    if (!document || document.deletedAt) {
      return NextResponse.json(
        { success: false, error: 'Document non trouvé' },
        { status: 404 }
      );
    }

    if (!document.bucketKey) {
      console.error(`[Document File] bucketKey manquant pour le document: ${document.id}`);
      return NextResponse.json(
        { success: false, error: 'Clé de stockage manquante' },
        { status: 404 }
      );
    }

    // Utiliser le service de stockage pour télécharger le fichier
    // Cela fonctionne en local ET sur Vercel (si un provider cloud est configuré)
    const storageService = getStorageService();
    
    // Pour les fichiers temporaires (tmp/), utiliser directement le bucketKey
    // Sinon, normaliser le bucketKey pour gérer les anciens formats (rétrocompatibilité)
    const isTemporaryFile = document.bucketKey.startsWith('tmp/');
    const keyToUse = isTemporaryFile 
      ? document.bucketKey 
      : storageService.normalizeBucketKey(
          document.bucketKey,
          document.id,
          document.filenameOriginal || document.fileName
        );
    
    // Vérifier si le fichier existe avant d'essayer de le télécharger
    try {
      const fileExists = await storageService.exists(keyToUse);
      if (!fileExists) {
        console.error(`[Document File] Fichier non trouvé dans le stockage:`, {
          bucketKey: document.bucketKey,
          keyToUse,
          isTemporaryFile,
          documentId: document.id,
          fileName: document.filenameOriginal || document.fileName
        });
        return NextResponse.json(
          { 
            success: false, 
            error: 'Fichier non trouvé dans le stockage',
            details: `Le document "${document.filenameOriginal || document.fileName}" existe dans la base de données mais le fichier physique est introuvable. Le fichier a peut-être été supprimé du stockage.`
          },
          { status: 404 }
        );
      }
    } catch (error: any) {
      console.error(`[Document File] Erreur lors de la vérification d'existence: ${error.message}`, {
        bucketKey: document.bucketKey,
        keyToUse,
        documentId: document.id
      });
      // Continuer quand même, peut-être que le provider ne supporte pas exists()
    }
    
    let fileBuffer: Buffer;
    try {
      fileBuffer = await storageService.downloadDocument(keyToUse);
    } catch (error: any) {
      console.error(`[Document File] Erreur lors du téléchargement: ${error.message}`, {
        bucketKey: document.bucketKey,
        keyToUse,
        isTemporaryFile,
        documentId: document.id,
        errorCode: error.code,
        errorStack: error.stack
      });
      return NextResponse.json(
        { 
          success: false, 
          error: 'Fichier non trouvé dans le stockage',
          details: `Impossible de télécharger le fichier. ${error.message || 'Erreur inconnue'}`,
          bucketKey: document.bucketKey,
          keyToUse
        },
        { status: 404 }
      );
    }

    // Déterminer le nom de fichier pour le téléchargement
    const downloadName = document.filenameOriginal || document.fileName;

    // Retourner le fichier avec les bons headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': document.mime || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${downloadName}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('[Document File] Erreur:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors de la récupération du fichier',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    );
  }
}

