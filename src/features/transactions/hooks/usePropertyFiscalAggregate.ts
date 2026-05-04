'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RentalPropertyInput } from '@/types/fiscal';

export type PropertyAggregateResponse = {
  biens: RentalPropertyInput[];
  year: number;
};

/**
 * Agrégat fiscal serveur pour un bien et une année (aligné sur FiscalAggregator / simulation LMNP).
 */
export function usePropertyFiscalAggregate(
  propertyId: string | undefined,
  year: number,
  enabled: boolean
) {
  const [data, setData] = useState<PropertyAggregateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled || !propertyId?.trim()) {
      setData(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        year: String(year),
        baseCalcul: 'encaisse',
        propertyId: propertyId.trim(),
      });
      const res = await fetch(`/api/fiscal/aggregate?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || errBody.details || `Erreur ${res.status}`);
      }
      const json = await res.json();
      setData({ biens: json.biens || [], year: json.year ?? year });
    } catch (e: unknown) {
      setData(null);
      setError(e instanceof Error ? e.message : 'Impossible de charger le périmètre fiscal');
    } finally {
      setLoading(false);
    }
  }, [enabled, propertyId, year]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}
