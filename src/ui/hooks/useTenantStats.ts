'use client';

import { useQuery } from '@tanstack/react-query';
import { qk } from '../../lib/queryKeys';

interface TenantStats {
  totalTenants: number;
  withActiveLease: number;
  withoutActiveLease: number;
  overdue: number;
  isLoading: boolean;
  error?: string;
}

export function useTenantStats(propertyId?: string): TenantStats {
  const { data, isLoading, error } = useQuery({
    queryKey: propertyId ? qk.tenants.stats(propertyId) : qk.tenants.stats(),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (propertyId) {
        params.append('propertyId', propertyId);
      }

      const response = await fetch(`/api/tenants/stats?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch tenant stats');
      }

      return response.json();
    },
    staleTime: 0, // Toujours rafraîchir pour les stats
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  return {
    totalTenants: data?.totalTenants || 0,
    withActiveLease: data?.withActiveLease || 0,
    withoutActiveLease: data?.withoutActiveLease || 0,
    overdue: data?.overdue || 0,
    isLoading,
    error: error instanceof Error ? error.message : undefined,
  };
}

