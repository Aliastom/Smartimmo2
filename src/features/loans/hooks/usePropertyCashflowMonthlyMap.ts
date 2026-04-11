'use client';

import { useState, useEffect } from 'react';
import { getLocalDB } from '@/lib/offline/db';
import type { CachedNature } from '@/lib/offline/db';
import { computeCashflowMonthlyAverageByProperty } from '@/features/loans/utils/cashflowByProperty';

/**
 * Cashflow mensuel moyen (12 mois) par propertyId, depuis IndexedDB — même règle que les KPI transactions.
 */
export function usePropertyCashflowMonthlyMap(
  mode: 'normal' | 'app-shell',
  organizationId: string | undefined,
) {
  const [cashflowMonthlyByPropertyId, setCashflowMonthlyByPropertyId] = useState<Map<string, number>>(
    () => new Map(),
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (mode !== 'app-shell' || !organizationId) {
      setCashflowMonthlyByPropertyId(new Map());
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const { getTransactionRepositoryOffline } = await import(
          '@/lib/offline/repositories/TransactionRepositoryOffline'
        );
        const transactions = await getTransactionRepositoryOffline().getAll(organizationId, {});
        const db = await getLocalDB();
        const naturesData = await db.NatureEntity.toArray();
        const natureMap = new Map<string, CachedNature>();
        naturesData.forEach((n: CachedNature) => natureMap.set(n.key, n));

        const map = computeCashflowMonthlyAverageByProperty(transactions, natureMap);
        if (!cancelled) {
          setCashflowMonthlyByPropertyId(map);
        }
      } catch (e) {
        console.error('[usePropertyCashflowMonthlyMap]', e);
        if (!cancelled) setCashflowMonthlyByPropertyId(new Map());
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();

    const onRefresh = () => {
      void load();
    };
    window.addEventListener('transactions:refresh', onRefresh);
    window.addEventListener('sync:refresh', onRefresh);

    return () => {
      cancelled = true;
      window.removeEventListener('transactions:refresh', onRefresh);
      window.removeEventListener('sync:refresh', onRefresh);
    };
  }, [mode, organizationId]);

  return { cashflowMonthlyByPropertyId, isLoadingCashflowMap: isLoading };
}
