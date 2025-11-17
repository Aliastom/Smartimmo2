import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { getStorageService } from '@/services/storage.service';

/**
 * DELETE /api/documents/[id]/delete
 * Suppression (soft delete) d'un document avec vérification des liens
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const documentId = params.id;

    if (!documentId) {
      return NextResponse.json(
        { success: false, error: 'ID de document manquant' },
        { status: 400 }
      );
    }

    // Récupérer le document avec ses relations
    const document = await prisma.document.findFirst({
      where: { id: documentId, organizationId },
      include: {
        Property: {
          select: { id: true, name: true }
        },
        Lease: {
          select: { id: true, Property: { select: { name: true } } }
        },
        Transaction: {
          select: { id: true, label: true }
        },
        Tenant: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });

    if (!document || document.deletedAt) {
      return NextResponse.json(
        { success: false, error: 'Document non trouvé' },
        { status: 404 }
      );
    }

    // Vérifier si le document est lié
    const links: Array<{type: string, id: string, name: string}> = [];
    
    if (document.propertyId && document.Property) {
      links.push({
        type: 'property',
        id: document.Property.id,
        name: document.Property.name
      });
    }
    
    if (document.leaseId && document.Lease) {
      links.push({
        type: 'lease',
        id: document.Lease.id,
        name: `Bail - ${document.Lease.Property?.name || 'N/A'}`
      });
    }
    
    if (document.transactionId && document.Transaction) {
      links.push({
        type: 'transaction',
        id: document.Transaction.id,
        name: document.Transaction.label
      });
    }
    
    if (document.tenantId && document.Tenant) {
      links.push({
        type: 'tenant',
        id: document.Tenant.id,
        name: `${document.Tenant.firstName} ${document.Tenant.lastName}`
      });
    }

    // Si lié, retourner erreur 409 avec les liens
    if (links.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'DOCUMENT_LINKED',
          details: 'Ce document est lié à d\'autres éléments',
          links
        },
        { status: 409 }
      );
    }

    const now = new Date();

    // Soft delete du document
    await prisma.document.update({
      where: { id: documentId },
      data: {
        deletedAt: now,
        deletedBy: user.id,
      }
    });

    // Supprimer le fichier du stockage (optionnel - soft delete uniquement par défaut)
    // Pour un hard delete, décommenter le code ci-dessous
    if (document.bucketKey) {
      try {
        const storageService = getStorageService();
        const normalizedKey = storageService.normalizeBucketKey(
          document.bucketKey,
          document.id,
          document.filenameOriginal || document.fileName
        );
        // Optionnel: supprimer physiquement le fichier (hard delete)
        // await storageService.deleteDocument(normalizedKey);
        // console.log(`[Delete] Document ${documentId} supprimé du stockage`);
      } catch (fileError) {
        console.error('[Delete] Erreur suppression fichier:', fileError);
        // Continuer même si la suppression échoue (soft delete suffit)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Document supprimé'
    });

  } catch (error) {
    console.error('[Delete Document] Erreur:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors de la suppression',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    );
  }
}

