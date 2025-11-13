import { prisma } from '@/lib/prisma';

export type DeleteMode = 'archive' | 'reassign' | 'cascade';

export interface DeletePropertyOptions {
  propertyId: string;
  mode: DeleteMode;
  targetPropertyId?: string;
}

export interface PropertyStats {
  leases: number;
  transactions: number;
  documents: number;
  echeances: number;
  loans: number;
}

/**
 * Récupère les statistiques d'un bien (nombre d'éléments liés)
 */
export async function getPropertyStats(propertyId: string): Promise<PropertyStats> {
  const [leases, transactions, documents, echeances, loans] = await Promise.all([
    prisma.lease.count({ where: { propertyId } }),
    prisma.transaction.count({ where: { propertyId } }),
    prisma.document.count({ where: { propertyId } }),
    prisma.echeanceRecurrente.count({ where: { propertyId } }),
    prisma.loan.count({ where: { propertyId } }),
  ]);

  return {
    leases,
    transactions,
    documents,
    echeances,
    loans,
  };
}

/**
 * Suppression intelligente d'un bien avec 3 modes
 */
export async function deletePropertySmart(options: DeletePropertyOptions): Promise<void> {
  const { propertyId, mode, targetPropertyId } = options;

  // Vérifier que le bien existe
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });

  if (!property) {
    throw new Error('Bien non trouvé');
  }

  // Récupérer les stats
  const stats = await getPropertyStats(propertyId);
  const hasLinkedData = stats.leases > 0 || stats.transactions > 0 || stats.documents > 0 || stats.echeances > 0 || stats.loans > 0;

  switch (mode) {
    case 'archive':
      await archiveProperty(propertyId);
      break;

    case 'reassign':
      if (!targetPropertyId) {
        throw new Error('Bien cible requis pour le transfert');
      }
      await reassignProperty(propertyId, targetPropertyId);
      break;

    case 'cascade':
      if (hasLinkedData) {
        throw new Error('Impossible de supprimer : des éléments sont liés à ce bien');
      }
      await cascadeDeleteProperty(propertyId);
      break;

    default:
      throw new Error(`Mode de suppression invalide: ${mode}`);
  }
}

/**
 * Mode A: Archiver le bien (soft delete)
 */
async function archiveProperty(propertyId: string): Promise<void> {
  await prisma.property.update({
    where: { id: propertyId },
    data: {
      isArchived: true,
      archivedAt: new Date(),
    },
  });

  console.log(`[ARCHIVE] Bien ${propertyId} archivé avec succès`);
}

/**
 * Mode B: Transférer vers un autre bien
 */
async function reassignProperty(sourcePropertyId: string, targetPropertyId: string): Promise<void> {
  // Vérifier que le bien cible existe
  const targetProperty = await prisma.property.findUnique({
    where: { id: targetPropertyId },
  });

  if (!targetProperty) {
    throw new Error('Bien cible non trouvé');
  }

  if (targetProperty.isArchived) {
    throw new Error('Le bien cible est archivé');
  }

  // Transaction Prisma pour réassigner tous les liens
  await prisma.$transaction(async (tx) => {
    // 1. Réassigner les baux
    await tx.lease.updateMany({
      where: { propertyId: sourcePropertyId },
      data: { propertyId: targetPropertyId },
    });

    // 2. Réassigner les transactions
    await tx.transaction.updateMany({
      where: { propertyId: sourcePropertyId },
      data: { propertyId: targetPropertyId },
    });

    // 3. Réassigner les documents
    await tx.document.updateMany({
      where: { propertyId: sourcePropertyId },
      data: { propertyId: targetPropertyId },
    });

    // 4. Réassigner les échéances récurrentes
    await tx.echeanceRecurrente.updateMany({
      where: { propertyId: sourcePropertyId },
      data: { propertyId: targetPropertyId },
    });

    // 5. Réassigner les prêts
    await tx.loan.updateMany({
      where: { propertyId: sourcePropertyId },
      data: { propertyId: targetPropertyId },
    });

    // 6. Réassigner les payments
    await tx.payment.updateMany({
      where: { propertyId: sourcePropertyId },
      data: { propertyId: targetPropertyId },
    });

    // 7. Réassigner les photos
    await tx.photo.updateMany({
      where: { propertyId: sourcePropertyId },
      data: { propertyId: targetPropertyId },
    });

    // 8. Réassigner l'historique d'occupation
    await tx.occupancyHistory.updateMany({
      where: { propertyId: sourcePropertyId },
      data: { propertyId: targetPropertyId },
    });

    // 9. Supprimer le bien source
    await tx.property.delete({
      where: { id: sourcePropertyId },
    });
  });

  console.log(`[REASSIGN] Bien ${sourcePropertyId} transféré vers ${targetPropertyId} et supprimé`);
}

/**
 * Mode C: Suppression définitive (cascade)
 * Seulement si aucune donnée liée
 */
async function cascadeDeleteProperty(propertyId: string): Promise<void> {
  // Double vérification
  const stats = await getPropertyStats(propertyId);
  const hasLinkedData = stats.leases > 0 || stats.transactions > 0 || stats.documents > 0 || stats.echeances > 0 || stats.loans > 0;

  if (hasLinkedData) {
    throw new Error('Impossible de supprimer : des éléments sont liés à ce bien');
  }

  // Supprimer le bien (Prisma cascade delete pour les photos et autres)
  await prisma.property.delete({
    where: { id: propertyId },
  });

  console.log(`[CASCADE] Bien ${propertyId} supprimé définitivement`);
}

