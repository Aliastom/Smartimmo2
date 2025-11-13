/**
 * Utilitaires pour la gestion des statuts de baux
 */

export interface Lease {
  id: string;
  status: string;
  startDate: string | Date;
  endDate?: string | Date | null;
  signedPdfUrl?: string | null;
}

/**
 * Calcule le statut runtime d'un bail basé sur les dates et le statut persistant
 */
export function getLeaseRuntimeStatus(lease: Lease): string {
  const now = new Date();
  const startDate = new Date(lease.startDate);
  const endDate = lease.endDate ? new Date(lease.endDate) : null;

  // Si le bail est résilié, il reste résilié
  if (lease.status === 'RÉSILIÉ' || lease.status === 'TERMINATED') {
    return 'terminated';
  }

  // Si le bail est un brouillon, il reste brouillon
  if (lease.status === 'BROUILLON' || lease.status === 'DRAFT') {
    return 'draft';
  }

  // Si le bail est envoyé mais pas signé, il reste envoyé
  if (lease.status === 'ENVOYÉ' || lease.status === 'SENT') {
    return 'sent';
  }

  // Si le bail est signé ou actif, on calcule selon les dates
  if (lease.status === 'SIGNÉ' || lease.status === 'SIGNED' || lease.status === 'ACTIF' || lease.status === 'ACTIVE') {
    // Si on est avant la date de début
    if (now < startDate) {
      return 'upcoming';
    }

    // Si on est après la date de fin (et qu'il y en a une)
    if (endDate && now > endDate) {
      return 'expired';
    }

    // Si on est dans la période active
    return 'active';
  }

  // Par défaut, retourner le statut tel quel
  return lease.status.toLowerCase();
}

/**
 * Vérifie si un bail est actif (dans sa période d'activité)
 */
export function isLeaseActive(lease: Lease): boolean {
  return getLeaseRuntimeStatus(lease) === 'active';
}

/**
 * Vérifie si un bail est expiré
 */
export function isLeaseExpired(lease: Lease): boolean {
  return getLeaseRuntimeStatus(lease) === 'expired';
}

/**
 * Vérifie si un bail est à venir
 */
export function isLeaseUpcoming(lease: Lease): boolean {
  return getLeaseRuntimeStatus(lease) === 'upcoming';
}

/**
 * Calcule le nombre de jours jusqu'à l'expiration d'un bail
 */
export function getDaysUntilExpiration(lease: Lease): number | null {
  if (!lease.endDate) return null;
  
  const now = new Date();
  const endDate = new Date(lease.endDate);
  const diffTime = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Calcule le nombre de jours jusqu'à l'indexation (approximation basée sur l'anniversaire)
 */
export function getDaysUntilIndexation(lease: Lease): number | null {
  if (!lease.startDate) return null;
  
  const now = new Date();
  const startDate = new Date(lease.startDate);
  const currentYear = now.getFullYear();
  
  // Calculer la prochaine date d'anniversaire
  let nextAnniversary = new Date(currentYear, startDate.getMonth(), startDate.getDate());
  
  // Si l'anniversaire est déjà passé cette année, prendre l'année suivante
  if (nextAnniversary <= now) {
    nextAnniversary = new Date(currentYear + 1, startDate.getMonth(), startDate.getDate());
  }
  
  const diffTime = nextAnniversary.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Détermine la prochaine action à effectuer sur un bail
 */
export function getNextAction(lease: Lease): string | null {
  const runtimeStatus = getLeaseRuntimeStatus(lease);
  const daysUntilExpiration = getDaysUntilExpiration(lease);
  const daysUntilIndexation = getDaysUntilIndexation(lease);

  // Si le bail expire bientôt
  if (daysUntilExpiration !== null && daysUntilExpiration <= 90 && daysUntilExpiration > 0) {
    return `Fin dans ${daysUntilExpiration}j`;
  }

  // Si le bail est expiré
  if (runtimeStatus === 'expired') {
    return 'Expiré';
  }

  // Si l'indexation est due bientôt
  if (daysUntilIndexation !== null && daysUntilIndexation <= 30 && daysUntilIndexation > 0) {
    return `Indexation dans ${daysUntilIndexation}j`;
  }

  // Si le bail n'est pas signé mais devrait l'être
  if (runtimeStatus === 'sent' && !lease.signedPdfUrl) {
    return 'En attente de signature';
  }

  return null;
}
