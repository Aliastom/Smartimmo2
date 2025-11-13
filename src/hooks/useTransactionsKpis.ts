import { useState, useEffect } from 'react';
import type { TransactionKpis } from '@/components/transactions/TransactionsKpiBar';

interface UseTransactionsKpisParams {
  periodStart?: string; // Format: 'YYYY-MM'
  periodEnd?: string; // Format: 'YYYY-MM'
  natureFilter?: string;
  statusFilter?: string;
  propertyId?: string;
  tenantId?: string;
  categoryId?: string;
  refreshKey?: number; // Pour forcer le rafraîchissement
}

export function useTransactionsKpis(params: UseTransactionsKpisParams = {}) {
  const [kpis, setKpis] = useState<TransactionKpis>({
    recettesTotales: 0,
    depensesTotales: 0,
    soldeNet: 0,
    nonRapprochees: 0,
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
        if (params.natureFilter) queryParams.append('natureFilter', params.natureFilter);
        if (params.statusFilter) queryParams.append('statusFilter', params.statusFilter);
        if (params.propertyId) queryParams.append('propertyId', params.propertyId);
        if (params.tenantId) queryParams.append('tenantId', params.tenantId);
        if (params.categoryId) queryParams.append('categoryId', params.categoryId);

        const response = await fetch(`/api/transactions/kpis?${queryParams.toString()}`);
        
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
    params.natureFilter,
    params.statusFilter,
    params.propertyId,
    params.tenantId,
    params.categoryId,
    params.refreshKey, // Ajout du refreshKey
  ]);

  return { kpis, isLoading, error };
}

