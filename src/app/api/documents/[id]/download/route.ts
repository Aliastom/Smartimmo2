import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStorageService } from '@/services/storage.service';
import { requireAuth } from '@/lib/auth/getCurrentUser';




// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: {
    id: string;
  };
}

/**
 * GET /api/documents/:id/download - Télécharge un document
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const user = await requireAuth();
    const { id } = context.params;

    const document = await prisma.document.findFirst({
      where: { id, organizationId: user.organizationId },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Vérifier soft-delete
    if (document.deletedAt) {
      return NextResponse.json(
        { error: 'Document has been deleted' },
        { status: 410 }
      );
    }

    // Télécharger depuis le storage
    const storageService = getStorageService();
    
    // Normaliser le bucketKey pour gérer les anciens formats (rétrocompatibilité)
    const normalizedKey = storageService.normalizeBucketKey(
      document.bucketKey,
      document.id,
      document.filenameOriginal || document.fileName
    );
    
    const buffer = await storageService.downloadDocument(normalizedKey);

    // Retourner le fichier
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': document.mime,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(document.filenameOriginal)}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('Error downloading document:', error);
    return NextResponse.json(
      { error: 'Failed to download document', details: error.message },
      { status: 500 }
    );
  }
}

