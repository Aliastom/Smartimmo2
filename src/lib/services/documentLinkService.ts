import { prisma } from '@/lib/prisma';

/**
 * Construit les liens à créer pour une transaction ou un prêt
 * @param documentId ID du document
 * @param tx Transaction/Prêt avec propertyId, leaseId, et loanId optionnels
 * @returns Array des liens à créer (sans les nulls)
 */
export function buildLinksForTx(
  documentId: string, 
  tx: { id: string, propertyId?: string | null, leaseId?: string | null, loanId?: string | null }
) {
  const links: Array<{documentId: string; linkedType: string; linkedId: string} | null> = [];
  
  // Déterminer le type de lien principal selon le contexte
  if ('loanId' in tx && tx.loanId) {
    // Si c'est un prêt, créer un lien pour le prêt
    links.push({ documentId, linkedType: 'loan', linkedId: tx.id });
  } else {
    // Sinon, c'est une transaction
    links.push({ documentId, linkedType: 'transaction', linkedId: tx.id });
  }
  
  // Liens secondaires (property, lease)
  if (tx.propertyId) {
    links.push({ documentId, linkedType: 'property', linkedId: tx.propertyId });
  }
  if (tx.leaseId) {
    links.push({ documentId, linkedType: 'lease', linkedId: tx.leaseId });
  }
  
  // Ajouter le lien global pour que le document apparaisse sur la page documents
  links.push({ documentId, linkedType: 'global', linkedId: 'global' });
  
  return links.filter(Boolean) as Array<{documentId: string; linkedType: string; linkedId: string}>;
}

/**
 * Vérifie que le document n'est pas déjà lié à un autre bien/bail incompatible
 * @param documentId ID du document
 * @param tx Transaction avec propertyId et leaseId optionnels
 * @throws Error si conflit de contexte détecté
 * 
 * Note: Un document peut être lié à plusieurs biens (partage de documents).
 * On bloque uniquement si le document est déjà lié à un bail différent.
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

  // Permettre les liens multiples vers différents biens (partage de documents)
  // On ne bloque plus les conflits de bien car un document peut être partagé entre plusieurs biens
  
  // Conflit de bail uniquement : un document ne devrait généralement pas être lié à plusieurs baux différents
  if (tx.leaseId && existingLinks.some(l => l.linkedType === 'lease' && l.linkedId !== tx.leaseId)) {
    throw new Error('CONTEXT_CONFLICT_LEASE'); // "Le document est déjà rattaché à un autre bail"
  }
  
  // Si le document est déjà lié au même bien, c'est OK (pas de conflit)
  // Si le document est lié à un autre bien, c'est aussi OK (partage autorisé)
}

/**
 * Crée les liens pour un document et une transaction/prêt avec validation
 * Gère manuellement les doublons car skipDuplicates ne fonctionne pas avec les clés composites
 * @param documentId ID du document
 * @param tx Transaction/Prêt avec propertyId, leaseId, et loanId optionnels
 * @returns Nombre de liens créés
 */
export async function createDocumentLinks(
  documentId: string, 
  tx: { id: string, propertyId?: string | null, leaseId?: string | null, loanId?: string | null }
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

