/**
 * SUPPRESSION SIMPLE - Helpers pour la suppression de documents et transactions
 * 
 * Ce fichier implémente une logique de suppression ultra simple :
 * - Hard delete des documents avec toutes leurs liaisons
 * - Suppression de transactions avec choix sur le devenir des documents
 */

import { prisma } from "@/lib/prisma";
import { unlink } from 'fs/promises';
import { join } from 'path';

/**
 * Supprime définitivement un document (hard delete) avec toutes ses liaisons
 * @param documentId - ID du document à supprimer
 */
export async function hardDeleteDocument(documentId: string, organizationId?: string) {
  // Récupérer le document pour obtenir les infos du fichier physique
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      ...(organizationId ? { organizationId } : {}),
    },
    select: { bucketKey: true, fileName: true }
  });

  if (!document) {
    throw new Error(`Document ${documentId} non trouvé`);
  }

  // Supprimer le document (cascade supprime automatiquement toutes les liaisons DocumentLink)
  await prisma.document.delete({ 
    where: { id: documentId } 
  });

  // Supprimer le fichier physique
  if (document.bucketKey) {
    try {
      const filePath = join(process.cwd(), 'storage', 'documents', document.bucketKey);
      await unlink(filePath);
      console.log(`✅ Fichier physique supprimé: ${document.fileName}`);
    } catch (error) {
      console.log(`⚠️  Fichier physique non trouvé: ${document.fileName} (${document.bucketKey})`);
      // Ne pas faire échouer la suppression si le fichier n'existe pas
    }
  }
}

/**
 * Liste toutes les liaisons non-globales d'un document
 * (Option simple : toutes les liaisons existantes sont considérées comme non-globales)
 * @param documentId - ID du document
 * @returns Liste des liaisons avec leur type et ID
 */
export async function listNonGlobalLinks(documentId: string, organizationId: string) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, organizationId },
    select: { id: true },
  });

  if (!document) {
    throw new Error('Document non trouvé ou non autorisé');
  }

  const links = await prisma.documentLink.findMany({
    where: { documentId },
    select: { 
      linkedType: true, 
      linkedId: true 
    },
  });
  
  return links;
}

/**
 * Modes de suppression de transaction
 */
export type DeleteTransactionMode = "delete_docs" | "keep_docs_globalize";

/**
 * Supprime une transaction avec gestion des documents liés
 * @param transactionId - ID de la transaction à supprimer
 * @param mode - Mode de suppression :
 *   - "delete_docs" : supprime les documents liés (hard delete)
 *   - "keep_docs_globalize" : conserve les documents en retirant toutes leurs liaisons non-globales
 */
export async function deleteTransactionWithDocs(
  transactionId: string, 
  mode: DeleteTransactionMode,
  organizationId: string
) {
  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, organizationId },
    select: { id: true },
  });

  if (!transaction) {
    throw new Error('Transaction non trouvée ou non autorisée');
  }

  // 1) Récupérer tous les documents liés à la transaction
  const links = await prisma.documentLink.findMany({
    where: { 
      linkedType: "transaction", 
      linkedId: transactionId,
      Document: {
        organizationId,
      }
    },
    select: { documentId: true },
  });
  
  const docIds = Array.from(new Set(links.map(l => l.documentId)));

  if (mode === "delete_docs") {
    // Mode A : Supprimer tous ces documents (hard delete avec cascade des liaisons)
    for (const docId of docIds) {
      await hardDeleteDocument(docId, organizationId);
    }
  } else {
    // Mode B (keep_docs_globalize) : Retirer toutes les liaisons non-globales pour ces documents
    // Supprimer toutes les liaisons existantes
    await prisma.documentLink.deleteMany({
      where: { documentId: { in: docIds } },
    });
    
    // Créer une liaison globale explicite pour chaque document
    if (docIds.length > 0) {
      await prisma.documentLink.createMany({
        data: docIds.map(docId => ({
          documentId: docId,
          linkedType: 'global',
          linkedId: 'global'
        }))
      });
      console.log(`✅ Liaisons globales créées pour ${docIds.length} documents`);
    }
  }

  // 2) Supprimer la transaction elle-même
  await prisma.transaction.delete({ 
    where: { id: transactionId } 
  });
}

/**
 * Récupère les informations lisibles sur une liaison pour l'affichage dans les modals
 * @param linkedType - Type de liaison (property, lease, transaction, tenant)
 * @param linkedId - ID de l'entité liée
 * @returns Un objet avec le type et un nom lisible
 */
export async function getLinkDisplayInfo(linkedType: string, linkedId: string, organizationId: string): Promise<{
  type: string;
  id: string;
  displayName: string;
}> {
  let displayName = linkedId; // Par défaut

  try {
    switch (linkedType) {
      case 'property':
        const property = await prisma.property.findFirst({
          where: { id: linkedId, organizationId },
          select: { name: true }
        });
        displayName = property?.name || `Bien #${linkedId.slice(0, 8)}`;
        break;

      case 'lease':
        const lease = await prisma.lease.findFirst({
          where: { id: linkedId, organizationId },
          select: { 
            Property: { select: { name: true } },
            Tenant: { select: { firstName: true, lastName: true } }
          }
        });
        if (lease) {
          const propName = lease.Property?.name || 'N/A';
          const tenantName = lease.Tenant ? `${lease.Tenant.firstName} ${lease.Tenant.lastName}` : 'N/A';
          displayName = `Bail - ${propName} (${tenantName})`;
        } else {
          displayName = `Bail #${linkedId.slice(0, 8)}`;
        }
        break;

      case 'transaction':
        const transaction = await prisma.transaction.findFirst({
          where: { id: linkedId, organizationId },
          select: { label: true }
        });
        displayName = transaction?.label || `Transaction #${linkedId.slice(0, 8)}`;
        break;

      case 'tenant':
        const tenant = await prisma.tenant.findFirst({
          where: { id: linkedId, organizationId },
          select: { firstName: true, lastName: true }
        });
        displayName = tenant ? `${tenant.firstName} ${tenant.lastName}` : `Locataire #${linkedId.slice(0, 8)}`;
        break;

      default:
        displayName = `${linkedType} #${linkedId.slice(0, 8)}`;
    }
  } catch (error) {
    console.error(`Erreur lors de la récupération des infos de liaison ${linkedType}:${linkedId}`, error);
  }

  return {
    type: linkedType,
    id: linkedId,
    displayName
  };
}

