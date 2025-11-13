import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readFile, mkdir, rename, unlink } from 'fs/promises';
import { join } from 'path';

/**
 * DELETE /api/documents/[id]/delete
 * Suppression (soft delete) d'un document avec vérification des liens
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // TODO: Ajouter protection authentification
    const documentId = params.id;

    if (!documentId) {
      return NextResponse.json(
        { success: false, error: 'ID de document manquant' },
        { status: 400 }
      );
    }

    // Récupérer le document avec ses relations
    const document = await prisma.document.findUnique({
      where: { id: documentId },
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
    
    if (document.transactionId && document.transaction) {
      links.push({
        type: 'transaction',
        id: document.transaction.id,
        name: document.transaction.label
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
        deletedBy: 'user', // TODO: Récupérer l'utilisateur authentifié
      }
    });

    // Déplacer le fichier vers la corbeille (trash)
    if (document.bucketKey) {
      try {
        const currentPath = join(process.cwd(), document.bucketKey);
        const trashDir = join(process.cwd(), 'storage', 'trash');
        await mkdir(trashDir, { recursive: true });
        
        const ext = document.bucketKey.split('.').pop() || 'bin';
        const trashPath = join(trashDir, `${documentId}.${ext}`);
        
        await rename(currentPath, trashPath).catch(async (renameError) => {
          // Si rename échoue, copier puis supprimer
          const fileBuffer = await readFile(currentPath);
          await writeFile(trashPath, fileBuffer);
          await unlink(currentPath);
        });
        
        console.log(`[Delete] Document ${documentId} déplacé vers trash`);
      } catch (fileError) {
        console.error('[Delete] Erreur déplacement fichier vers trash:', fileError);
        // Continuer même si le déplacement échoue
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

