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
    
    // Normaliser le bucketKey pour gérer les anciens formats (rétrocompatibilité)
    const normalizedKey = storageService.normalizeBucketKey(
      document.bucketKey,
      document.id,
      document.filenameOriginal || document.fileName
    );
    
    let fileBuffer: Buffer;
    try {
      fileBuffer = await storageService.downloadDocument(normalizedKey);
    } catch (error: any) {
      console.error(`[Document File] Erreur lors du téléchargement: ${error.message}`, {
        bucketKey: document.bucketKey,
        normalizedKey,
        documentId: document.id
      });
      return NextResponse.json(
        { success: false, error: 'Fichier non trouvé dans le stockage' },
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

