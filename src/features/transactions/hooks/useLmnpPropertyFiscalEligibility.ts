'use client';

import { useEffect, useState } from 'react';
import { getLocalDB } from '@/lib/offline/db';
import { getPropertyRepositoryOffline } from '@/lib/offline/repositories/PropertyRepositoryOffline';
import { computeLmnpFiscalViewEligible } from '@/features/transactions/lib/propertyLmnpEligibility';

/**
 * Éligibilité vue fiscale LMNP pour un bien (IndexedDB + caches fiscal type/régime).
 */
export function useLmnpPropertyFiscalEligibility(
  propertyId: string | undefined,
  organizationId: string | undefined,
  enabled: boolean
) {
  const [eligible, setEligible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !propertyId?.trim() || !organizationId) {
      setEligible(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const repo = getPropertyRepositoryOffline();
        const prop = await repo.getById(propertyId.trim(), organizationId);
        if (cancelled) return;

        if (!prop) {
          setEligible(false);
          return;
        }

        const db = await getLocalDB();
        const [ft, fr] = await Promise.all([
          prop.fiscalTypeId ? db.FiscalType.get(prop.fiscalTypeId) : Promise.resolve(undefined),
          prop.fiscalRegimeId ? db.FiscalRegime.get(prop.fiscalRegimeId) : Promise.resolve(undefined),
        ]);

        if (cancelled) return;

        setEligible(computeLmnpFiscalViewEligible(prop, ft ?? null, fr ?? null));
      } catch {
        if (!cancelled) setEligible(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, propertyId, organizationId]);

  return { eligible, loading };
}
