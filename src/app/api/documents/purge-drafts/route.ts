import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { getStorageService } from '@/services/storage.service';



// POST /api/documents/purge-drafts - Purger les documents brouillons

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const body = await request.json().catch(() => ({}));
    const force = body.force === true; // Si force=true, purger TOUS les brouillons
    
    console.log(`[API] Purge des documents brouillons${force ? ' (TOUS - mode forcÃ©)' : ' orphelins'}...`);
    
    // 1. Trouver les documents brouillons Ã  supprimer
    const whereClause = force 
      ? { status: 'draft' as const, organizationId }
      : { // Mode normal : uniquement les orphelins
          status: 'draft' as const,
          organizationId,
          OR: [
            { uploadSessionId: null }, // Sans session
            {
              UploadSession: {
                expiresAt: { lt: new Date() } // Session expirÃ©e
              }
            }
          ]
        };
    
    const orphanedDocuments = await prisma.document.findMany({
      where: whereClause,
      include: {
        UploadSession: {
          select: {
            id: true,
            expiresAt: true
          }
        }
      }
    });

    console.log(`[API] ${orphanedDocuments.length} document(s) brouillon orphelin(s) trouvÃ©(s)`);

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

    // 2. Supprimer chaque document orphelin
    for (const doc of orphanedDocuments) {
      try {
        // Supprimer le fichier physique via le service de stockage s'il existe
        if (doc.bucketKey) {
          try {
            const storageService = getStorageService();
            await storageService.deleteDocument(doc.bucketKey);
            console.log(`[API] Fichier physique supprimé du stockage: ${doc.bucketKey}`);
          } catch (fileError) {
            console.warn(`[API] Impossible de supprimer le fichier du stockage: ${doc.bucketKey}`, fileError);
          }
        }
        
        // Supprimer l'entrÃ©e de base
        await prisma.document.delete({
          where: { id: doc.id }
        });
        
        results.deleted++;
        results.details.push({
          id: doc.id,
          filename: doc.filenameOriginal,
          status: 'success'
        });
        
        console.log(`[API] Document brouillon supprimÃ©: ${doc.id} (${doc.filenameOriginal})`);
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

    // 3. Nettoyer les sessions expirÃ©es sans documents
    const expiredSessions = await prisma.uploadSession.findMany({
      where: {
        organizationId,
        expiresAt: { lt: new Date() },
        Document: { none: {} }
      }
    });

    for (const session of expiredSessions) {
      try {
        await prisma.uploadSession.delete({
          where: { id: session.id }
        });
        console.log(`[API] Session expirÃ©e supprimÃ©e: ${session.id}`);
      } catch (error) {
        console.error(`[API] Erreur lors de la suppression de la session ${session.id}:`, error);
      }
    }

    console.log(`[API] Purge terminÃ©e: ${results.deleted} supprimÃ©s, ${results.errors} erreurs`);

    return NextResponse.json({
      success: true,
      message: `Purge terminÃ©e: ${results.deleted} document(s) supprimÃ©(s), ${results.errors} erreur(s)`,
      results
    });

  } catch (error) {
    console.error('[API] Erreur lors de la purge des documents brouillons:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors de la purge des documents brouillons',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    );
  }
}

// GET /api/documents/purge-drafts - Obtenir les statistiques des documents brouillons
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    console.log('[API] RÃ©cupÃ©ration des statistiques des documents brouillons...');
    
    // TOUS les documents brouillons
    const totalDrafts = await prisma.document.count({
      where: {
        status: 'draft',
        organizationId,
      }
    });
    
    // Documents brouillons avec session active
    const activeDrafts = await prisma.document.count({
      where: {
        status: 'draft',
        organizationId,
        UploadSession: {
          expiresAt: { gte: new Date() }
        }
      }
    });

    // Documents brouillons orphelins
    const orphanedDrafts = await prisma.document.count({
      where: {
        status: 'draft',
        organizationId,
        OR: [
          { uploadSessionId: null },
          {
            UploadSession: {
              expiresAt: { lt: new Date() }
            }
          }
        ]
      }
    });

    // Sessions expirÃ©es
    const expiredSessions = await prisma.uploadSession.count({
      where: {
        organizationId,
        expiresAt: { lt: new Date() }
      }
    });

    // Sessions actives
    const activeSessions = await prisma.uploadSession.count({
      where: {
        organizationId,
        expiresAt: { gte: new Date() }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        totalDrafts,
        activeDrafts,
        orphanedDrafts,
        expiredSessions,
        activeSessions,
        totalSessions: activeSessions + expiredSessions
      }
    });

  } catch (error) {
    console.error('[API] Erreur lors de la rÃ©cupÃ©ration des statistiques:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors de la rÃ©cupÃ©ration des statistiques',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    );
  }
}
