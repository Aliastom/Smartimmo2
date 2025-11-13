import { useState, useEffect } from 'react';
import type { LeasesKpis } from '@/components/leases/LeasesKpiBar';

interface UseLeasesKpisParams {
  propertyId?: string;
  refreshKey?: number; // Pour forcer le rafraîchissement
}

export function useLeasesKpis(params: UseLeasesKpisParams = {}) {
  const [kpis, setKpis] = useState<LeasesKpis>({
    totalLeases: 0,
    activeLeases: 0,
    expiringSoon: 0,
    indexationDue: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchKpis = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams();
        
        if (params.propertyId) queryParams.append('propertyId', params.propertyId);

        const response = await fetch(`/api/leases/kpis?${queryParams.toString()}`);
        
        if (!response.ok) {
          throw new Error('Erreur lors du chargement des KPI des baux');
        }

        const data = await response.json();
        setKpis(data);
      } catch (err) {
        console.error('Erreur lors du chargement des KPI des baux:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchKpis();
  }, [
    params.propertyId,
    params.refreshKey,
  ]);

  return { kpis, isLoading, error };
}

