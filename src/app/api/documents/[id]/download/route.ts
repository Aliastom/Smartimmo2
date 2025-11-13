import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PrismaClient } from '@prisma/client';
import { getStorageService } from '@/services/storage.service';



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
    const { id } = context.params;

    const document = await prisma.document.findUnique({
      where: { id },
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
    const buffer = await storageService.downloadDocument(document.bucketKey);

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

