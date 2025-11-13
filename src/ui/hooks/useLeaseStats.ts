'use client';

import { useQuery } from '@tanstack/react-query';
import { qk } from '../../lib/queryKeys';

interface LeaseStats {
  totalLeases: number;
  activeLeases: number;
  expiringIn60Days: number;
  totalMonthlyRent: number;
  isLoading: boolean;
  error?: string;
}

export function useLeaseStats(propertyId?: string): LeaseStats {
  const { data, isLoading, error } = useQuery({
    queryKey: qk.Lease.stats(propertyId),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (propertyId) {
        params.append('propertyId', propertyId);
      }

      const response = await fetch(`/api/leases/stats?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch lease stats');
      }

      return response.json();
    },
    staleTime: 0, // Toujours rafraîchir pour les stats
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  return {
    totalLeases: data?.totalLeases || 0,
    activeLeases: data?.activeLeases || 0,
    expiringIn60Days: data?.expiringIn60Days || 0,
    totalMonthlyRent: data?.totalMonthlyRent || 0,
    isLoading,
    error: error instanceof Error ? error.message : undefined,
  };
}

