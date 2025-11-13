import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { prisma } from '@/lib/prisma';



/**
 * GET /api/documents/cleanup?type=draft&dryRun=true
 * GET /api/documents/cleanup?type=orphan&dryRun=true
 * Obtenir la liste des documents Ã  nettoyer (dry run)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const dryRun = searchParams.get('dryRun') === 'true';

    if (!type || !['draft', 'orphan'].includes(type)) {
      return NextResponse.json(
        { error: 'Type invalide. Utilisez "draft" ou "orphan"' },
        { status: 400 }
      );
    }

    let documents: any[] = [];
    let count = 0;

    if (type === 'draft') {
      // Documents brouillons
      documents = await prisma.document.findMany({
        where: {
          status: 'draft',
          deletedAt: null
        },
        select: {
          id: true,
          filenameOriginal: true,
          status: true,
          createdAt: true,
          uploadSessionId: true,
          uploadSession: {
            select: {
              id: true,
              expiresAt: true
            }
          }
        }
      });
      count = documents.length;
    } else if (type === 'orphan') {
      // Documents orphelins (sans liaisons)
      documents = await prisma.document.findMany({
        where: {
          deletedAt: null,
          DocumentLink: { none: {} } // Aucun lien DocumentLink
        },
        select: {
          id: true,
          filenameOriginal: true,
          status: true,
          createdAt: true,
          bucketKey: true
        }
      });
      count = documents.length;
    }

    return NextResponse.json({
      success: true,
      type,
      dryRun,
      count,
      documents: dryRun ? documents : undefined
    });

  } catch (error) {
    console.error('[API] Erreur lors de la rÃ©cupÃ©ration des documents Ã  nettoyer:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors de la rÃ©cupÃ©ration des documents',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents/cleanup?type=draft
 * DELETE /api/documents/cleanup?type=orphan
 * Supprimer les documents selon le type
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (!type || !['draft', 'orphan'].includes(type)) {
      return NextResponse.json(
        { error: 'Type invalide. Utilisez "draft" ou "orphan"' },
        { status: 400 }
      );
    }

    console.log(`[API] Nettoyage des documents ${type}...`);

    let documents: any[] = [];
    let whereClause: any = {};

    if (type === 'draft') {
      // Documents brouillons
      whereClause = {
        status: 'draft',
        deletedAt: null
      };
    } else if (type === 'orphan') {
      // Documents orphelins (sans liaisons)
      whereClause = {
        deletedAt: null,
        DocumentLink: { none: {} }
      };
    }

    // RÃ©cupÃ©rer les documents Ã  supprimer
    documents = await prisma.document.findMany({
      where: whereClause,
      include: {
        DocumentLink: true
      }
    });

    console.log(`[API] ${documents.length} document(s) ${type} trouvÃ©(s)`);

    const results = {
      deleted: 0,
      errors: 0,
      details: [] as Array<{
        id: string;
        filename: string;
        status: 'success' | 'error';
        error?: string;
      }>
    };

    // Supprimer chaque document
    for (const doc of documents) {
      try {
        // VÃ©rification supplÃ©mentaire pour les orphelins
        if (type === 'orphan' && doc.DocumentLink && doc.DocumentLink.length > 0) {
          console.log(`[API] Document ${doc.id} a des liens, ignorÃ©`);
          continue;
        }

        // Supprimer le fichier physique s'il existe
        if (doc.bucketKey) {
          const filePath = join(process.cwd(), 'storage', 'documents', doc.bucketKey);
          try {
            await unlink(filePath);
            console.log(`[API] Fichier physique supprimÃ©: ${filePath}`);
          } catch (fileError) {
            console.warn(`[API] Impossible de supprimer le fichier: ${filePath}`, fileError);
            // Continuer mÃªme si le fichier n'existe pas
          }
        }

        // Supprimer les liens d'abord (si orphelin)
        if (type === 'orphan' && doc.DocumentLink && doc.DocumentLink.length > 0) {
          await prisma.documentLink.deleteMany({
            where: { documentId: doc.id }
          });
        }

        // Supprimer le document
        await prisma.document.delete({
          where: { id: doc.id }
        });

        results.deleted++;
        results.details.push({
          id: doc.id,
          filename: doc.filenameOriginal,
          status: 'success'
        });

        console.log(`[API] Document ${type} supprimÃ©: ${doc.id} (${doc.filenameOriginal})`);
      } catch (error) {
        results.errors++;
        results.details.push({
          id: doc.id,
          filename: doc.filenameOriginal,
          status: 'error',
          error: error instanceof Error ? error.message : 'Erreur inconnue'
        });
        console.error(`[API] Erreur lors de la suppression du document ${doc.id}:`, error);
      }
    }

    console.log(`[API] Nettoyage terminÃ©: ${results.deleted} supprimÃ©s, ${results.errors} erreurs`);

    return NextResponse.json({
      success: true,
      message: `Nettoyage terminÃ©: ${results.deleted} document(s) supprimÃ©(s), ${results.errors} erreur(s)`,
      type,
      results
    });

  } catch (error) {
    console.error(`[API] Erreur lors du nettoyage des documents ${type}:`, error);
    return NextResponse.json(
      {
        success: false,
        error: `Erreur lors du nettoyage des documents ${type}`,
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    );
  }
}
