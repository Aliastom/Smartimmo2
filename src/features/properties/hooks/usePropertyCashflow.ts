'use client';

/**
 * Hook pour obtenir le cashflow d'un bien avec la même source de calcul que la page Biens.
 * Utilise getCashflow (mensuel moyen sur 12 mois) pour cohérence menu / card.
 */

import { useState, useEffect } from 'react';
import { getTransactionRepositoryOffline } from '@/lib/offline/repositories/TransactionRepositoryOffline';
import { getLocalDB } from '@/lib/offline/db';
import type { CachedNature } from '@/lib/offline/db';
import { convertTransactionForChart } from '../utils/propertiesCalculations';
import { getCashflow, CASHFLOW_DEFAULT_PERIOD_MONTHS } from '../utils/propertyDashboard';

export function usePropertyCashflow(propertyId: string | null, organizationId: string | null) {
  const [cashflow, setCashflow] = useState<number | null>(null);
  const [loading, setLoading] = useState(!!propertyId && !!organizationId);

  useEffect(() => {
    if (!propertyId || !organizationId) {
      setCashflow(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const db = await getLocalDB();
        const transRepo = getTransactionRepositoryOffline();
        const [raw, naturesData] = await Promise.all([
          transRepo.getAll(organizationId),
          db.NatureEntity.toArray(),
        ]);
        if (cancelled) return;
        const natureMap = new Map<string, CachedNature>();
        naturesData.forEach((n) => natureMap.set(n.key, n));
        const transactions = raw.map((t) => convertTransactionForChart(t, natureMap));
        const value = getCashflow(propertyId, transactions, { periodMonths: CASHFLOW_DEFAULT_PERIOD_MONTHS });
        if (!cancelled) setCashflow(value);
      } catch (e) {
        if (!cancelled) setCashflow(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [propertyId, organizationId]);

  return { cashflow, loading };
}
