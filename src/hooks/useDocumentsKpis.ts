import { useState, useEffect } from 'react';

export interface DocumentKpis {
  total: number;
  pending: number;
  unclassified: number;
  ocrFailed: number;
  orphans: number;
}

interface UseDocumentsKpisParams {
  periodStart?: string; // Format: 'YYYY-MM'
  periodEnd?: string; // Format: 'YYYY-MM'
  refreshKey?: number; // Pour forcer le rafraîchissement
  propertyId?: string; // Pour filtrer par bien
}

export function useDocumentsKpis(params: UseDocumentsKpisParams = {}) {
  const [kpis, setKpis] = useState<DocumentKpis>({
    total: 0,
    pending: 0,
    unclassified: 0,
    ocrFailed: 0,
    orphans: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchKpis = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams();
        
        if (params.periodStart) queryParams.append('periodStart', params.periodStart);
        if (params.periodEnd) queryParams.append('periodEnd', params.periodEnd);
        if (params.propertyId) queryParams.append('propertyId', params.propertyId);

        const response = await fetch(`/api/documents/kpis?${queryParams.toString()}`);
        
        if (!response.ok) {
          throw new Error('Erreur lors du chargement des KPI');
        }

        const data = await response.json();
        setKpis(data);
      } catch (err) {
        console.error('Erreur lors du chargement des KPI:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchKpis();
  }, [
    params.periodStart,
    params.periodEnd,
    params.refreshKey,
    params.propertyId,
  ]);

  return { kpis, isLoading, error };
}

