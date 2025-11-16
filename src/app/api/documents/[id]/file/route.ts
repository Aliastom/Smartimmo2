import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readFile, access } from 'fs/promises';
import { join } from 'path';
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

    // Construire le chemin du fichier
    // Essayer d'abord avec bucketKey
    let filePath = join(process.cwd(), document.bucketKey);
    let fileExists = false;

    // Vérifier que le fichier existe avec bucketKey
    try {
      await access(filePath);
      fileExists = true;
    } catch {
      // Si le fichier n'existe pas avec bucketKey, essayer avec l'URL
      if (document.url) {
        // Extraire le chemin de l'URL (enlever /storage/ du début si présent)
        let urlPath = document.url.replace(/^\/api\/documents\/[^/]+\/file/, '');
        if (urlPath.startsWith('/storage/')) {
          urlPath = urlPath.substring(1); // Enlever le / du début
        } else if (!urlPath.startsWith('storage/')) {
          urlPath = `storage/${urlPath}`;
        }
        
        filePath = join(process.cwd(), urlPath);
        
        try {
          await access(filePath);
          fileExists = true;
        } catch {
          // Dernier essai: si l'URL commence par /storage/, utiliser directement
          if (document.url.startsWith('/storage/')) {
            filePath = join(process.cwd(), document.url.substring(1));
            try {
              await access(filePath);
              fileExists = true;
            } catch {
              // Pas trouvé
            }
          }
        }
      }
    }

    if (!fileExists) {
      console.error(`[Document File] Fichier non trouvé: ${document.bucketKey} (URL: ${document.url})`);
      return NextResponse.json(
        { success: false, error: 'Fichier non trouvé sur le disque' },
        { status: 404 }
      );
    }

    // Lire le fichier
    const fileBuffer = await readFile(filePath);

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

