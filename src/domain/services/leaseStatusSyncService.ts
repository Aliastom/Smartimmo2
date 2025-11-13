import { prisma } from '@/lib/prisma';
import { getLeaseRuntimeStatus } from '../leases/status';

/**
 * Synchronise les statuts des baux avec leur statut calculé en temps réel
 * Met à jour la base de données pour refléter le statut actuel
 */
export async function syncLeaseStatuses(): Promise<{
  updated: number;
  details: Array<{ id: string; oldStatus: string; newStatus: string }>;
}> {
  const leases = await prisma.lease.findMany({
    where: {
      status: { not: 'RÉSILIÉ' } // Ne pas toucher aux baux résiliés
    },
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      signedPdfUrl: true
    }
  });

  const updates: Array<{ id: string; oldStatus: string; newStatus: string }> = [];
  const leaseIdsToUpdate: string[] = [];

  for (const lease of leases) {
    const runtimeStatus = getLeaseRuntimeStatus(lease);
    
    // Mapper le statut runtime vers le statut DB
    let newDbStatus: string;
    switch (runtimeStatus) {
      case 'draft':
        newDbStatus = 'BROUILLON';
        break;
      case 'upcoming':
        newDbStatus = 'À_VENIR';
        break;
      case 'active':
        newDbStatus = 'ACTIF';
        break;
      case 'expired':
        newDbStatus = 'EXPIRÉ';
        break;
      case 'signed':
        newDbStatus = 'SIGNÉ';
        break;
      default:
        continue; // Pas de changement
    }

    // Si le statut a changé, l'ajouter à la liste des mises à jour
    if (lease.status !== newDbStatus) {
      updates.push({
        id: lease.id,
        oldStatus: lease.status,
        newStatus: newDbStatus
      });
      leaseIdsToUpdate.push(lease.id);
    }
  }

  // Effectuer les mises à jour en batch
  if (leaseIdsToUpdate.length > 0) {
    await prisma.lease.updateMany({
      where: {
        id: { in: leaseIdsToUpdate }
      },
      data: {
        updatedAt: new Date()
      }
    });

    // Mettre à jour chaque bail individuellement avec son nouveau statut
    for (const update of updates) {
      await prisma.lease.update({
        where: { id: update.id },
        data: { status: update.newStatus }
      });
    }
  }

  return {
    updated: updates.length,
    details: updates
  };
}

/**
 * Synchronise le statut d'un bail spécifique
 */
export async function syncLeaseStatus(leaseId: string): Promise<{
  updated: boolean;
  oldStatus?: string;
  newStatus?: string;
}> {
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      signedPdfUrl: true
    }
  });

  if (!lease) {
    throw new Error(`Lease ${leaseId} not found`);
  }

  const runtimeStatus = getLeaseRuntimeStatus(lease);
  
  // Mapper le statut runtime vers le statut DB
  let newDbStatus: string;
  switch (runtimeStatus) {
    case 'draft':
      newDbStatus = 'BROUILLON';
      break;
    case 'upcoming':
      newDbStatus = 'À_VENIR';
      break;
    case 'active':
      newDbStatus = 'ACTIF';
      break;
    case 'expired':
      newDbStatus = 'EXPIRÉ';
      break;
    case 'signed':
      newDbStatus = 'SIGNÉ';
      break;
    default:
      return { updated: false };
  }

  // Si le statut a changé, le mettre à jour
  if (lease.status !== newDbStatus) {
    await prisma.lease.update({
      where: { id: leaseId },
      data: { 
        status: newDbStatus,
        updatedAt: new Date()
      }
    });

    return {
      updated: true,
      oldStatus: lease.status,
      newStatus: newDbStatus
    };
  }

  return { updated: false };
}

/**
 * Synchronise les statuts des baux d'une propriété
 */
export async function syncPropertyLeaseStatuses(propertyId: string): Promise<{
  updated: number;
  details: Array<{ id: string; oldStatus: string; newStatus: string }>;
}> {
  const leases = await prisma.lease.findMany({
    where: {
      propertyId,
      status: { not: 'RÉSILIÉ' }
    },
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      signedPdfUrl: true
    }
  });

  const updates: Array<{ id: string; oldStatus: string; newStatus: string }> = [];

  for (const lease of leases) {
    const runtimeStatus = getLeaseRuntimeStatus(lease);
    
    let newDbStatus: string;
    switch (runtimeStatus) {
      case 'draft':
        newDbStatus = 'BROUILLON';
        break;
      case 'upcoming':
        newDbStatus = 'À_VENIR';
        break;
      case 'active':
        newDbStatus = 'ACTIF';
        break;
      case 'expired':
        newDbStatus = 'EXPIRÉ';
        break;
      case 'signed':
        newDbStatus = 'SIGNÉ';
        break;
      default:
        continue;
    }

    if (lease.status !== newDbStatus) {
      await prisma.lease.update({
        where: { id: lease.id },
        data: { 
          status: newDbStatus,
          updatedAt: new Date()
        }
      });

      updates.push({
        id: lease.id,
        oldStatus: lease.status,
        newStatus: newDbStatus
      });
    }
  }

  return {
    updated: updates.length,
    details: updates
  };
}
