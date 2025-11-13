'use client';

import { useQuery } from '@tanstack/react-query';

interface TransactionStats {
  totalTransactions: number;
  rentReceived: number;
  chargesPaid: number;
  balance: number;
}

interface TransactionStatsFilters {
  propertyId?: string;
  month?: number;
  year?: number;
  dateFrom?: string;
  dateTo?: string;
}

export function useTransactionStats(filters: TransactionStatsFilters = {}) {
  return useQuery<TransactionStats>({
    queryKey: ['transaction-stats', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (filters.propertyId) {
        params.append('propertyId', filters.propertyId);
      }
      if (filters.month !== undefined) {
        params.append('month', filters.month.toString());
      }
      if (filters.year !== undefined) {
        params.append('year', filters.year.toString());
      }
      if (filters.dateFrom) {
        params.append('dateFrom', filters.dateFrom);
      }
      if (filters.dateTo) {
        params.append('dateTo', filters.dateTo);
      }

      const response = await fetch(`/api/payments/stats?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch transaction stats');
      }

      return response.json();
    },
    staleTime: 30 * 1000, // 30 secondes
    refetchOnWindowFocus: false,
  });
}

