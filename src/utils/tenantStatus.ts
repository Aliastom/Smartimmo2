/**
 * Utilitaire pour calculer le statut d'un locataire basé sur ses baux
 */

export type TenantStatus = 'ACTIF' | 'A_VENIR' | 'INACTIF' | 'BROUILLON';

export interface LeaseInfo {
  id: string;
  status: string;
  startDate: Date | string;
  endDate: Date | string;
}

export interface TenantStatusInfo {
  computedStatus: TenantStatus;
  activeLeaseCount: number;
  futureLeaseCount: number;
  draftLeaseCount: number;
  expiredLeaseCount: number;
}

/**
 * Calcule le statut d'un locataire basé sur ses baux
 */
export function computeTenantStatus(leases: LeaseInfo[]): TenantStatusInfo {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normaliser à minuit

  let activeLeaseCount = 0;
  let futureLeaseCount = 0;
  let draftLeaseCount = 0;
  let expiredLeaseCount = 0;

  // Analyser chaque bail
  for (const lease of leases) {
    const startDate = new Date(lease.startDate);
    const endDate = new Date(lease.endDate);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999); // Fin de journée

    switch (lease.status) {
      case 'ACTIVE':
        if (startDate <= today && today <= endDate) {
          activeLeaseCount++;
        } else if (startDate > today) {
          futureLeaseCount++;
        } else {
          expiredLeaseCount++;
        }
        break;
      case 'SIGNED':
        if (startDate > today) {
          futureLeaseCount++;
        } else if (startDate <= today && today <= endDate) {
          activeLeaseCount++;
        } else {
          expiredLeaseCount++;
        }
        break;
      case 'DRAFT':
        draftLeaseCount++;
        break;
      case 'EXPIRED':
        expiredLeaseCount++;
        break;
      default:
        // Fallback basé sur les dates si le statut n'est pas fiable
        if (startDate <= today && today <= endDate) {
          activeLeaseCount++;
        } else if (startDate > today) {
          futureLeaseCount++;
        } else {
          expiredLeaseCount++;
        }
    }
  }

  // Déterminer le statut principal
  let computedStatus: TenantStatus;
  
  if (activeLeaseCount > 0) {
    computedStatus = 'ACTIF';
  } else if (futureLeaseCount > 0) {
    computedStatus = 'A_VENIR';
  } else if (draftLeaseCount > 0) {
    computedStatus = 'BROUILLON';
  } else {
    computedStatus = 'INACTIF';
  }

  return {
    computedStatus,
    activeLeaseCount,
    futureLeaseCount,
    draftLeaseCount,
    expiredLeaseCount,
  };
}

/**
 * Obtient le style du badge pour un statut
 */
export function getTenantStatusStyle(status: TenantStatus): { bg: string; text: string; label: string } {
  switch (status) {
    case 'ACTIF':
      return { bg: 'bg-green-100', text: 'text-green-800', label: 'Actif' };
    case 'A_VENIR':
      return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'À venir' };
    case 'BROUILLON':
      return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Brouillon' };
    case 'INACTIF':
      return { bg: 'bg-base-200', text: 'text-base-content', label: 'Inactif' };
    default:
      return { bg: 'bg-base-200', text: 'text-base-content', label: status };
  }
}
