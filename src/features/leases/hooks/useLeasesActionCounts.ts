'use client';

import { useState, useEffect, useCallback } from 'react';
import { getEcheanceRepositoryOffline } from '@/lib/offline/repositories/EcheanceRepositoryOffline';
import { getTransactionRepositoryOffline } from '@/lib/offline/repositories/TransactionRepositoryOffline';
import { getLocalDB } from '@/lib/offline/db';
import { computeLeaseHealthStatut, type EcheanceForHealth, type TransactionForHealth } from '../utils/leaseHealthCalculator';
import type { LeaseWithDetails } from '@/lib/services/leasesService';
import { getLeaseIndexationStatus } from '../utils/leaseIndexationStatus';
import {
  buildLeasePriorityActions,
  type LeasePriorityAction,
  type LeasePilotageRowMeta,
  type LeasePaymentPilotageMeta,
} from '../utils/buildLeasePriorityActions';
import { deriveCritiquePriorityActionsFromPilotage } from '../utils/leasePilotageSection';
import type { LeasesActionCounts } from '../types/leasesActionCounts';

export type { LeasePriorityAction, LeasePilotageRowMeta, LeasePaymentPilotageMeta };
export type { LeasesActionCounts };

const EMPTY: LeasesActionCounts = {
  partiels: 0,
  retards: 0,
  expirant90: 0,
  indexations: 0,
  leaseIdsPartiels: new Set(),
  leaseIdsRetards: new Set(),
  leaseIdsExpirant90: new Set(),
  leaseIdsIndexations: new Set(),
};

export function useLeasesActionCounts(
  organizationId: string | null,
  leases: LeaseWithDetails[],
  mode: 'normal' | 'app-shell'
) {
  const [counts, setCounts] = useState<LeasesActionCounts>(EMPTY);
  const [priorityActions, setPriorityActions] = useState<LeasePriorityAction[]>([]);
  const [leasePilotageById, setLeasePilotageById] = useState<Record<string, LeasePilotageRowMeta>>({});
  const [leasePaymentPilotageById, setLeasePaymentPilotageById] = useState<
    Record<string, LeasePaymentPilotageMeta>
  >({});
  const [loading, setLoading] = useState(true);

  const compute = useCallback(async () => {
    if (!organizationId || leases.length === 0) {
      setCounts(EMPTY);
      setPriorityActions([]);
      setLeasePilotageById({});
      setLeasePaymentPilotageById({});
      setLoading(false);
      return;
    }

    // En mode normal, on ne calcule pas les comptes santé (nécessite IDB)
    if (mode === 'normal') {
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      const in90Days = new Date(today);
      in90Days.setDate(in90Days.getDate() + 90);
      const in30Days = new Date(today);
      in30Days.setDate(in30Days.getDate() + 30);

      const leaseIdsExpirant90 = new Set<string>();
      const leaseIdsIndexations = new Set<string>();
      let indexationsByLease = new Map<string, Array<{ effectiveDate: string }>>();
      try {
        const db = await getLocalDB();
        const all = await db.RentIndexation.where('organizationId').equals(organizationId).toArray();
        all.forEach((item: { leaseId: string; effectiveDate: string }) => {
          const cur = indexationsByLease.get(item.leaseId) ?? [];
          cur.push({ effectiveDate: item.effectiveDate });
          indexationsByLease.set(item.leaseId, cur);
        });
      } catch {
        indexationsByLease = new Map();
      }

      for (const lease of leases) {
        if (lease.endDate) {
          const endDate = new Date(lease.endDate);
          endDate.setHours(0, 0, 0, 0);
          if (
            (lease.status === 'ACTIF' || lease.status === 'SIGNÉ' || lease.status === 'SIGNE') &&
            endDate <= in90Days &&
            endDate >= today
          ) {
            leaseIdsExpirant90.add(lease.id);
          }
        }

        const idx = getLeaseIndexationStatus(
          {
            status: lease.status,
            indexationType: lease.indexationType,
            startDate: lease.startDate,
          },
          indexationsByLease.get(lease.id) ?? [],
          now
        );
        if (idx.status === 'UPCOMING' || idx.status === 'DUE') leaseIdsIndexations.add(lease.id);
      }

      setCounts({
        ...EMPTY,
        expirant90: leaseIdsExpirant90.size,
        indexations: leaseIdsIndexations.size,
        leaseIdsExpirant90,
        leaseIdsIndexations,
      });
      setPriorityActions([]);
      setLeasePilotageById({});
      setLeasePaymentPilotageById({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const echRepo = getEcheanceRepositoryOffline();
      const txRepo = getTransactionRepositoryOffline();

      const [allEcheances, allTransactions, rentIndexations] = await Promise.all([
        echRepo.getAll(organizationId, { isActive: true }),
        txRepo.getAll(organizationId, {}),
        (await getLocalDB()).RentIndexation.where('organizationId').equals(organizationId).toArray(),
      ]);
      const indexationsByLease = new Map<string, Array<{ effectiveDate: string }>>();
      rentIndexations.forEach((item: { leaseId: string; effectiveDate: string }) => {
        const cur = indexationsByLease.get(item.leaseId) ?? [];
        cur.push({ effectiveDate: item.effectiveDate });
        indexationsByLease.set(item.leaseId, cur);
      });

      const leaseIdsPartiels = new Set<string>();
      const leaseIdsRetards = new Set<string>();
      const leaseIdsExpirant90 = new Set<string>();
      const leaseIdsIndexations = new Set<string>();

      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      const in90Days = new Date(today);
      in90Days.setDate(in90Days.getDate() + 90);
      const in30Days = new Date(today);
      in30Days.setDate(in30Days.getDate() + 30);

      for (const lease of leases) {
        // Santé : partiel / retard
        const echForLease = allEcheances.filter(
          (e) => e.leaseId === lease.id
        ) as EcheanceForHealth[];
        const txForLease = allTransactions.filter(
          (t) => (t as any).leaseId === lease.id
        ) as TransactionForHealth[];

        const statut = computeLeaseHealthStatut(
          {
            leaseId: lease.id,
            paymentDay: lease.paymentDay ?? 5,
            rentAmount: lease.rentAmount,
            chargesRecupMensuelles: lease.chargesRecupMensuelles ?? 0,
          },
          echForLease,
          txForLease
        );

        if (statut === 'retard') leaseIdsRetards.add(lease.id);
        else if (statut === 'partiel') leaseIdsPartiels.add(lease.id);

        // Expirant < 90 jours
        if (lease.endDate) {
          const endDate = new Date(lease.endDate);
          endDate.setHours(0, 0, 0, 0);
          const isActive = ['ACTIF', 'SIGNÉ', 'SIGNE'].includes(lease.status);
          if (isActive && endDate <= in90Days && endDate >= today) {
            leaseIdsExpirant90.add(lease.id);
          }
        }

        // Indexations à prévoir
        const idx = getLeaseIndexationStatus(
          {
            status: lease.status,
            indexationType: lease.indexationType,
            startDate: lease.startDate,
          },
          indexationsByLease.get(lease.id) ?? [],
          now
        );
        if (idx.status === 'UPCOMING' || idx.status === 'DUE') leaseIdsIndexations.add(lease.id);
      }

      const pilotage = buildLeasePriorityActions({
        leases,
        allEcheances: allEcheances as EcheanceForHealth[],
        allTransactions: allTransactions as TransactionForHealth[],
        indexationsByLease,
        now,
      });
      const nextCounts: LeasesActionCounts = {
        partiels: leaseIdsPartiels.size,
        retards: leaseIdsRetards.size,
        expirant90: leaseIdsExpirant90.size,
        indexations: leaseIdsIndexations.size,
        leaseIdsPartiels,
        leaseIdsRetards,
        leaseIdsExpirant90,
        leaseIdsIndexations,
      };
      setLeasePilotageById(pilotage.leasePilotageById);
      setLeasePaymentPilotageById(pilotage.leasePaymentPilotageById);
      setCounts(nextCounts);
      setPriorityActions(
        deriveCritiquePriorityActionsFromPilotage(leases, pilotage.leasePilotageById, nextCounts)
      );
    } catch (err) {
      console.error('[useLeasesActionCounts]', err);
      setCounts(EMPTY);
      setPriorityActions([]);
      setLeasePilotageById({});
      setLeasePaymentPilotageById({});
    } finally {
      setLoading(false);
    }
  }, [organizationId, leases, mode]);

  useEffect(() => {
    compute();
  }, [compute]);

  // ✅ Rafraîchir quand une transaction est créée (ex: "Payer le reste")
  // OPTIM: mise à jour incrémentale si leaseId présent (un seul bail concerné)
  useEffect(() => {
    const handleRefresh = (event: Event) => {
      const detail = event instanceof CustomEvent && event.detail ? (event.detail as { reason?: string }) : null;
      const isLeasesTx = event.type === 'leases:refresh' && detail?.reason === 'tx';
      if (isLeasesTx) return;
      void compute();
    };

    window.addEventListener('transactions:refresh', handleRefresh);
    window.addEventListener('leases:refresh', handleRefresh);
    return () => {
      window.removeEventListener('transactions:refresh', handleRefresh);
      window.removeEventListener('leases:refresh', handleRefresh);
    };
  }, [compute]);

  return { counts, priorityActions, leasePilotageById, leasePaymentPilotageById, loading };
}
