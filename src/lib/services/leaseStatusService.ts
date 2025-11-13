import { prisma } from '@/lib/prisma';

/**
 * Service pour gérer les statuts automatiques des baux
 */

export async function checkAndUpdateLeaseStatuses() {
  try {
    const today = new Date();
    
    // Trouver tous les baux signés qui devraient être actifs
    const signedLeases = await prisma.lease.findMany({
      where: {
        status: 'SIGNED',
        startDate: {
          lte: today
        }
      }
    });

    // Mettre à jour les baux qui devraient être actifs
    const updates = [];
    for (const lease of signedLeases) {
      // Vérifier si le bail est dans sa période active
      const isInActivePeriod = !lease.endDate || new Date(lease.endDate) >= today;
      
      if (isInActivePeriod) {
        updates.push(
          prisma.lease.update({
            where: { id: lease.id },
            data: { 
              status: 'ACTIVE',
              updatedAt: new Date()
            }
          })
        );
      }
    }

    // Exécuter toutes les mises à jour
    if (updates.length > 0) {
      await Promise.all(updates);
      console.log(`${updates.length} baux mis à jour automatiquement vers ACTIF`);
    }

    return { updated: updates.length };
  } catch (error) {
    console.error('Error checking lease statuses:', error);
    throw error;
  }
}

/**
 * Vérifie si un bail devrait être automatiquement actif
 */
export function shouldBeActive(lease: {
  status: string;
  startDate: Date | string;
  endDate?: Date | string | null;
}): boolean {
  const today = new Date();
  const startDate = new Date(lease.startDate);
  
  // Le bail doit être signé
  if (lease.status !== 'SIGNED') {
    return false;
  }
  
  // La date de début doit être atteinte
  if (today < startDate) {
    return false;
  }
  
  // S'il y a une date de fin, elle ne doit pas être dépassée
  if (lease.endDate) {
    const endDate = new Date(lease.endDate);
    if (today > endDate) {
      return false;
    }
  }
  
  return true;
}
