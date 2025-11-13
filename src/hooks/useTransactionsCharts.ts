import { useState, useEffect } from 'react';
import type { MonthlyData } from '@/components/transactions/TransactionsCumulativeChart';
import type { CategoryData } from '@/components/transactions/TransactionsByCategoryChart';
import type { IncomeExpenseData } from '@/components/transactions/TransactionsIncomeExpenseChart';

interface UseTransactionsChartsParams {
  periodStart?: string; // Format: 'YYYY-MM'
  periodEnd?: string; // Format: 'YYYY-MM'
  natureFilter?: string;
  statusFilter?: string;
  propertyId?: string;
  tenantId?: string;
  categoryId?: string;
  refreshKey?: number; // Pour forcer le rafraîchissement
}

export interface TransactionsChartsData {
  timeline: MonthlyData[];
  byCategory: CategoryData[];
  incomeExpense: IncomeExpenseData;
}

export function useTransactionsCharts(params: UseTransactionsChartsParams = {}) {
  const [data, setData] = useState<TransactionsChartsData>({
    timeline: [],
    byCategory: [],
    incomeExpense: { income: 0, expense: 0 },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchCharts = async () => {
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
        
        // Ajouter un timestamp pour éviter le cache
        queryParams.append('_t', Date.now().toString());

        const response = await fetch(`/api/transactions/charts?${queryParams.toString()}`, {
          cache: 'no-store', // Forcer le no-cache
        });
        
        if (!response.ok) {
          throw new Error('Erreur lors du chargement des graphiques');
        }

        const responseData = await response.json();
        setData(responseData);
      } catch (err) {
        console.error('Erreur lors du chargement des graphiques:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCharts();
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

  return { data, isLoading, error };
}

