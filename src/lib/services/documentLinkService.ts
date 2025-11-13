import { prisma } from '@/lib/prisma';

/**
 * Construit les liens à créer pour une transaction
 * @param documentId ID du document
 * @param tx Transaction avec propertyId et leaseId optionnels
 * @returns Array des liens à créer (sans les nulls)
 */
export function buildLinksForTx(
  documentId: string, 
  tx: { id: string, propertyId?: string | null, leaseId?: string | null }
) {
  return [
    { documentId, linkedType: 'transaction', linkedId: tx.id },
    tx.propertyId ? { documentId, linkedType: 'property', linkedId: tx.propertyId } : null,
    tx.leaseId ? { documentId, linkedType: 'lease', linkedId: tx.leaseId } : null,
    // Ajouter le lien global pour que le document apparaisse sur la page documents
    { documentId, linkedType: 'global', linkedId: 'global' },
  ].filter(Boolean) as Array<{documentId: string; linkedType: string; linkedId: string}>;
}

/**
 * Vérifie que le document n'est pas déjà lié à un autre bien/bail incompatible
 * @param documentId ID du document
 * @param tx Transaction avec propertyId et leaseId optionnels
 * @throws Error si conflit de contexte détecté
 */
export async function ensureCompatibleContext(
  documentId: string, 
  tx: { propertyId?: string | null, leaseId?: string | null }
) {
  const existingLinks = await prisma.documentLink.findMany({
    where: { 
      documentId, 
      linkedType: { in: ['property', 'lease'] } 
    },
    select: { linkedType: true, linkedId: true }
  });

  // Conflit de bien
  if (tx.propertyId && existingLinks.some(l => l.linkedType === 'property' && l.linkedId !== tx.propertyId)) {
    throw new Error('CONTEXT_CONFLICT_PROPERTY'); // "Le document est déjà rattaché à un autre bien"
  }
  
  // Conflit de bail
  if (tx.leaseId && existingLinks.some(l => l.linkedType === 'lease' && l.linkedId !== tx.leaseId)) {
    throw new Error('CONTEXT_CONFLICT_LEASE'); // "Le document est déjà rattaché à un autre bail"
  }
}

/**
 * Crée les liens pour un document et une transaction avec validation
 * Gère manuellement les doublons car skipDuplicates ne fonctionne pas avec les clés composites
 * @param documentId ID du document
 * @param tx Transaction avec propertyId et leaseId optionnels
 * @returns Nombre de liens créés
 */
export async function createDocumentLinks(
  documentId: string, 
  tx: { id: string, propertyId?: string | null, leaseId?: string | null }
) {
  // Vérifier la compatibilité du contexte
  await ensureCompatibleContext(documentId, tx);
  
  // Construire les liens
  const links = buildLinksForTx(documentId, tx);
  
  // Créer les liens un par un en ignorant les doublons
  // (skipDuplicates ne fonctionne pas avec les clés composites dans Prisma)
  let createdCount = 0;
  for (const link of links) {
    try {
      const existing = await prisma.documentLink.findUnique({
        where: {
          documentId_linkedType_linkedId: {
            documentId: link.documentId,
            linkedType: link.linkedType,
            linkedId: link.linkedId
          }
        }
      });
      
      if (!existing) {
        await prisma.documentLink.create({ data: link });
        createdCount++;
        console.log(`[DocumentLinkService] Lien créé: ${link.linkedType}/${link.linkedId}`);
      } else {
        console.log(`[DocumentLinkService] Lien déjà existant: ${link.linkedType}/${link.linkedId}`);
      }
    } catch (error) {
      console.error(`[DocumentLinkService] Erreur création lien:`, error);
      // Continuer avec les autres liens même en cas d'erreur
    }
  }
  
  console.log(`[DocumentLinkService] ${createdCount} nouveaux liens créés pour document ${documentId}`);
  return createdCount;
}

