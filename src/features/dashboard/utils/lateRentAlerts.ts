/**
 * Logique métier unique pour les "loyers en retard" (relances).
 * Utilisée par : Dashboard, résumé Alertes, détail Alertes (TasksPanel).
 * Une seule définition = plus de divergence résumé / détail.
 */

import type { LoyerNonEncaisse } from '@/types/dashboard';

export type LateRentMode = 'open_arrears_as_of_month' | 'due_in_selected_month';

/** Entrée minimale pour un bail (compatible API Prisma et IDB) */
export interface LeaseForRelances {
  id: string;
  propertyId: string | null;
  tenantId: string | null;
  rentAmount: number;
  startDate: string;
  endDate: string | null;
  status?: string;
}

export interface GetLateRentAlertsParams {
  leases: LeaseForRelances[];
  /** Set de "leaseId-accountingMonth" pour les mois considérés comme payés (nature+cat loyer) */
  paidMonths: Set<string>;
  /** Mois sélectionné (YYYY-MM). Référence pour "à la fin de ce mois". */
  selectedMonth: string;
  /** Mode : impayés ouverts à fin du mois vs échéances du mois uniquement */
  mode: LateRentMode;
  propertyNameById: Map<string, string>;
  tenantNameById: Map<string, string>;
  /** Date d'acquisition par bien (optionnel, pour héritage) */
  acquisitionDateByPropertyId?: Map<string, string | null>;
}

/**
 * Retourne les loyers en retard selon le mode choisi.
 * - open_arrears_as_of_month : tous les impayés encore ouverts à la fin du mois sélectionné (recommandé pour le pilotage).
 * - due_in_selected_month : uniquement les échéances du mois sélectionné non payées.
 */
export function getLateRentAlerts(params: GetLateRentAlertsParams): LoyerNonEncaisse[] {
  const {
    leases,
    paidMonths,
    selectedMonth,
    mode,
    propertyNameById,
    tenantNameById,
    acquisitionDateByPropertyId = new Map(),
  } = params;

  const [year, monthNum] = selectedMonth.split('-').map(Number);
  const refEndOfMonth = new Date(year, monthNum, 0, 23, 59, 59);

  const relances: LoyerNonEncaisse[] = [];

  for (const lease of leases) {
    const propertyId = lease.propertyId || 'unknown';
    const propertyName = propertyNameById.get(propertyId) || '';
    const tenantName = lease.tenantId ? (tenantNameById.get(lease.tenantId) || '') : '';

    const leaseStart = new Date(lease.startDate);
    const leaseEnd = lease.endDate ? new Date(lease.endDate) : null;
    const acquisitionDate = acquisitionDateByPropertyId.get(propertyId);
    const propertyAcquisition = acquisitionDate ? new Date(acquisitionDate) : null;
    const effectiveStart = propertyAcquisition && propertyAcquisition > leaseStart ? propertyAcquisition : leaseStart;

    const startMonth = new Date(effectiveStart.getFullYear(), effectiveStart.getMonth(), 1);
    const endMonth = leaseEnd
      ? new Date(leaseEnd.getFullYear(), leaseEnd.getMonth(), 1)
      : new Date(refEndOfMonth.getFullYear(), refEndOfMonth.getMonth(), 1);
    const cutoffEnd = endMonth > refEndOfMonth
      ? new Date(refEndOfMonth.getFullYear(), refEndOfMonth.getMonth(), 1)
      : endMonth;

    let current = new Date(startMonth);

    while (current <= cutoffEnd) {
      const accountingMonth = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
      const isPastMonth = accountingMonth < selectedMonth;
      const isCurrentMonth = accountingMonth === selectedMonth;

      if (isPastMonth || isCurrentMonth) {
        const isPaid = paidMonths.has(`${lease.id}-${accountingMonth}`);
        if (!isPaid) {
          const endOfMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0);
          const retardJours = Math.floor(
            (refEndOfMonth.getTime() - endOfMonth.getTime()) / (1000 * 60 * 60 * 24)
          );

          relances.push({
            id: `${lease.id}-${accountingMonth}`,
            leaseId: lease.id,
            propertyId,
            propertyName,
            tenantName,
            montant: lease.rentAmount || 0,
            dateEcheance: endOfMonth.toISOString().split('T')[0],
            accountingMonth,
            retardJours: Math.max(0, retardJours),
            statut: 'en_retard',
          });
        }
      }
      current.setMonth(current.getMonth() + 1);
    }
  }

  relances.sort((a, b) => b.retardJours - a.retardJours);

  if (mode === 'due_in_selected_month') {
    return relances.filter((r) => r.accountingMonth === selectedMonth);
  }

  return relances;
}

/** Libellé pour la section loyers en retard (impayés ouverts à fin du mois) */
export function getLateRentsSectionLabel(selectedMonth: string, count: number): string {
  const [y, m] = selectedMonth.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  const monthLabel = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^\w/, (c) => c.toUpperCase());
  return `Impayés ouverts à fin ${monthLabel}${count > 0 ? ` (${count})` : ''}`;
}

/** Libellé pour le filtre "échéances du mois" */
export function getDueInMonthFilterLabel(selectedMonth: string): string {
  const [y, m] = selectedMonth.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^\w/, (c) => c.toUpperCase());
}
