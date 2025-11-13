'use client';

import { useEffect, useState } from 'react';

interface LoanStats {
  totalLoans: number;
  totalRemainingCapital: number;
  interestPaid: number;
  dueSoon: number;
  isLoading: boolean;
  error?: string;
}

interface LoanStatsFilters {
  propertyId?: string;
  month?: number;
  year?: number;
}

export function useLoanStats(filters: LoanStatsFilters = {}): LoanStats {
  const [stats, setStats] = useState<LoanStats>({
    totalLoans: 0,
    totalRemainingCapital: 0,
    interestPaid: 0,
    dueSoon: 0,
    isLoading: true,
  });

  useEffect(() => {
    async function fetchStats() {
      try {
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

        const response = await fetch(`/api/loans/stats?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch loan stats');
        }

        const data = await response.json();
        setStats({
          ...data,
          isLoading: false,
        });
      } catch (error) {
        console.error('Error fetching loan stats:', error);
        setStats(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    }

    fetchStats();
  }, [filters.propertyId, filters.month, filters.year]);

  return stats;
}

