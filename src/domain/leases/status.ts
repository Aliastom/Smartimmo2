/**
 * Logique de calcul des statuts de baux en temps réel
 */

import { isBetweenInclusive, compareDates, getToday } from '../../utils/date';

export type LeaseRuntimeStatus = 'active' | 'signed' | 'upcoming' | 'expired' | 'draft';

export interface Lease {
  id: string;
  propertyId: string;
  tenantId: string;
  type: string;
  startDate: string | Date;
  endDate?: string | Date | null;
  status?: string; // Statut persistant en DB (BROUILLON | ENVOYÉ | SIGNÉ | ACTIF | RÉSILIÉ | ARCHIVÉ)
  signedPdfUrl?: string; // URL du PDF signé (indique si signé)
  rentAmount: number;
  charges?: number;
  deposit?: number;
  paymentDay?: number;
  notes?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

/**
 * Calcule le statut en temps réel d'un bail
 * 
 * Règles :
 * - ACTIF si: (status='SIGNÉ' OU signedPdfUrl existe) AND today ∈ [startDate, endDate] AND status != 'RÉSILIÉ'
 * - EXPIRÉ si: today > endDate
 * - À VENIR si: today < startDate ET signé
 * - BROUILLON si: pas signé (status='BROUILLON' ET pas de signedPdfUrl)
 * - SIGNÉ si: signé mais pas dans la période active
 */
export function getLeaseRuntimeStatus(
  lease: Lease,
  now: string | Date = getToday()
): LeaseRuntimeStatus {
  const today = typeof now === 'string' ? now : getToday();
  
  // Si le bail est résilié (statut persistant)
  if (lease.status === 'RÉSILIÉ') {
    return 'expired';
  }
  
  // Déterminer si le bail est signé
  const isSigned = lease.status === 'SIGNÉ' || lease.status === 'ACTIF' || !!lease.signedPdfUrl;
  
  // Si pas signé → BROUILLON
  if (!isSigned) {
    return 'draft';
  }
  
  // Si pas de date de fin → considérer comme actif si signé et après la date de début
  if (!lease.endDate) {
    const startComparison = compareDates(today, lease.startDate);
    return startComparison >= 0 ? 'active' : 'upcoming';
  }
  
  // Si dans la période [startDate, endDate] → ACTIF
  if (isBetweenInclusive(today, lease.startDate, lease.endDate)) {
    return 'active';
  }
  
  // Si avant la date de début → À VENIR
  if (compareDates(today, lease.startDate) < 0) {
    return 'upcoming';
  }
  
  // Si après la date de fin → EXPIRÉ
  if (compareDates(today, lease.endDate) > 0) {
    return 'expired';
  }
  
  // Par défaut → SIGNÉ (signé mais pas dans la période active)
  return 'signed';
}

/**
 * Retourne les informations d'affichage pour un statut
 */
export function getLeaseStatusDisplay(status: LeaseRuntimeStatus): {
  label: string;
  className: string;
  color: 'green' | 'blue' | 'gray' | 'red' | 'yellow';
} {
  switch (status) {
    case 'active':
      return {
        label: 'ACTIF',
        className: 'bg-green-100 text-green-800 border-green-200',
        color: 'green'
      };
    case 'signed':
      return {
        label: 'SIGNÉ',
        className: 'bg-blue-100 text-blue-800 border-blue-200',
        color: 'blue'
      };
    case 'upcoming':
      return {
        label: 'À VENIR',
        className: 'bg-blue-100 text-blue-800 border-blue-200',
        color: 'blue'
      };
    case 'expired':
      return {
        label: 'EXPIRÉ',
        className: 'bg-base-200 text-base-content opacity-80 border-base-300',
        color: 'gray'
      };
    case 'draft':
      return {
        label: 'BROUILLON',
        className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        color: 'yellow'
      };
    default:
      return {
        label: 'INCONNU',
        className: 'bg-base-200 text-base-content opacity-80 border-base-300',
        color: 'gray'
      };
  }
}
