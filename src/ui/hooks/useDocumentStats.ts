'use client';

import { useEffect, useState } from 'react';

interface DocumentStats {
  totalDocuments: number;
  receipts: number;
  signedLeases: number;
  unassigned: number;
  isLoading: boolean;
  error?: string;
}

interface DocumentStatsFilters {
  propertyId?: string;
  month?: number;
  year?: number;
}

export function useDocumentStats(filters: DocumentStatsFilters = {}): DocumentStats {
  const [stats, setStats] = useState<DocumentStats>({
    totalDocuments: 0,
    receipts: 0,
    signedLeases: 0,
    unassigned: 0,
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

        const response = await fetch(`/api/documents/stats?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch document stats');
        }

        const data = await response.json();
        setStats({
          ...data,
          isLoading: false,
        });
      } catch (error) {
        console.error('Error fetching document stats:', error);
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

