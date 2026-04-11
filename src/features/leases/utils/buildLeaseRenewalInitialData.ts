import type { LeaseWithDetails } from '@/lib/services/leasesService';

/**
 * Données initiales pour un bail de renouvellement (même logique partout : page globale, bien, App Shell).
 */
export function buildLeaseRenewalInitialData(lease: LeaseWithDetails) {
  const baseEnd = lease.endDate ? new Date(lease.endDate) : new Date();
  const nextStart = new Date(baseEnd);
  nextStart.setDate(nextStart.getDate() + 1);

  const nextEnd = new Date(nextStart);
  const isOneYear =
    lease.furnishedType === 'MEUBLE' ||
    lease.furnishedType === 'meuble' ||
    lease.furnishedType === 'garage';
  nextEnd.setFullYear(nextEnd.getFullYear() + (isOneYear ? 1 : 3));

  return {
    propertyId: lease.propertyId,
    tenantId: lease.tenantId,
    type: lease.type || 'residential',
    furnishedType: (lease.furnishedType || 'vide').toLowerCase(),
    startDate: nextStart.toISOString().slice(0, 10),
    endDate: nextEnd.toISOString().slice(0, 10),
    rentAmount: lease.rentAmount,
    deposit: lease.deposit || 0,
    paymentDay: lease.paymentDay || 1,
    indexationType: (lease.indexationType || 'none').toLowerCase(),
    chargesRecupMensuelles: lease.chargesRecupMensuelles || 0,
    chargesNonRecupMensuelles: lease.chargesNonRecupMensuelles || 0,
    status: 'BROUILLON',
    notes: `Renouvellement du bail ${lease.id}${lease.notes ? `\n\n${lease.notes}` : ''}`,
  };
}
