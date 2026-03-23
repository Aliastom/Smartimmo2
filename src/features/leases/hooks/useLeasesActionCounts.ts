'use client';

import { useState, useEffect, useCallback } from 'react';
import { getEcheanceRepositoryOffline } from '@/lib/offline/repositories/EcheanceRepositoryOffline';
import { getTransactionRepositoryOffline } from '@/lib/offline/repositories/TransactionRepositoryOffline';
import { getLocalDB } from '@/lib/offline/db';
import { computeLeaseHealthStatut, type EcheanceForHealth, type TransactionForHealth } from '../utils/leaseHealthCalculator';
import type { LeaseWithDetails } from '@/lib/services/leasesService';
import { getLeaseIndexationStatus } from '../utils/leaseIndexationStatus';

export interface LeasesActionCounts {
  partiels: number;
  retards: number;
  expirant90: number;
  indexations: number;
  leaseIdsPartiels: Set<string>;
  leaseIdsRetards: Set<string>;
  leaseIdsExpirant90: Set<string>;
  leaseIdsIndexations: Set<string>;
}

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
  const [loading, setLoading] = useState(true);

  const compute = useCallback(async () => {
    if (!organizationId || leases.length === 0) {
      setCounts(EMPTY);
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

      const leaseIds = new Set(leases.map((l) => l.id));
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

      setCounts({
        partiels: leaseIdsPartiels.size,
        retards: leaseIdsRetards.size,
        expirant90: leaseIdsExpirant90.size,
        indexations: leaseIdsIndexations.size,
        leaseIdsPartiels,
        leaseIdsRetards,
        leaseIdsExpirant90,
        leaseIdsIndexations,
      });
    } catch (err) {
      console.error('[useLeasesActionCounts]', err);
      setCounts(EMPTY);
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
    const handleRefresh = async (event: Event) => {
      const detail = (event instanceof CustomEvent && event.detail) 
        ? (event.detail as { leaseId?: string; scope?: string; propertyId?: string; reason?: string }) 
        : null;
      const leaseId = detail?.leaseId;

      // leases:refresh avec reason='tx' est redondant avec transactions:refresh, éviter double traitement
      const isLeasesTx = event.type === 'leases:refresh' && detail?.reason === 'tx';
      if (isLeasesTx) return;

      if (leaseId && organizationId && mode === 'app-shell') {
        const lease = leases.find((l) => l.id === leaseId);
        if (!lease) return;

        try {
          const echRepo = getEcheanceRepositoryOffline();
          const txRepo = getTransactionRepositoryOffline();
          const [echForLease, txForLease] = await Promise.all([
            echRepo.getAll(organizationId, { leaseId, isActive: true }) as Promise<EcheanceForHealth[]>,
            txRepo.getAll(organizationId, { leaseId }) as Promise<TransactionForHealth[]>,
          ]);

          const newStatut = computeLeaseHealthStatut(
            {
              leaseId: lease.id,
              paymentDay: lease.paymentDay ?? 5,
              rentAmount: lease.rentAmount,
              chargesRecupMensuelles: lease.chargesRecupMensuelles ?? 0,
            },
            echForLease,
            txForLease
          );

          setCounts((prev) => {
            const next = {
              ...prev,
              leaseIdsPartiels: new Set(prev.leaseIdsPartiels),
              leaseIdsRetards: new Set(prev.leaseIdsRetards),
            };
            next.leaseIdsPartiels.delete(leaseId);
            next.leaseIdsRetards.delete(leaseId);
            if (newStatut === 'retard') next.leaseIdsRetards.add(leaseId);
            else if (newStatut === 'partiel') next.leaseIdsPartiels.add(leaseId);
            next.partiels = next.leaseIdsPartiels.size;
            next.retards = next.leaseIdsRetards.size;
            return next;
          });
        } catch (err) {
          console.warn('[useLeasesActionCounts] Incrémental échoué, fallback full:', err);
          compute();
        }
      } else {
        compute();
      }
    };

    const bound = (e: Event) => handleRefresh(e);
    window.addEventListener('transactions:refresh', bound);
    window.addEventListener('leases:refresh', bound);
    return () => {
      window.removeEventListener('transactions:refresh', bound);
      window.removeEventListener('leases:refresh', bound);
    };
  }, [organizationId, leases, mode, compute]);

  return { counts, loading };
}
