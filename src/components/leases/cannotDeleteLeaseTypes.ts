/**
 * Données affichées dans CannotDeleteLeaseModal.
 * offerTerminate : true uniquement si le bail est encore actif et que la résiliation est l’action pertinente.
 */
export interface CannotDeleteLeaseItem {
  id: string;
  propertyName: string;
  tenantName: string;
  reason: string;
  offerTerminate?: boolean;
}
