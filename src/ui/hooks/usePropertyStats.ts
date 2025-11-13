'use client';

import { useQuery } from '@tanstack/react-query';
import { qk } from '../../lib/queryKeys';

interface PropertyStats {
  totalProperties: number;
  occupied: number;
  vacant: number;
  totalMonthlyRent: number;
  isLoading: boolean;
  error?: string;
}

export function usePropertyStats(propertyId?: string): PropertyStats {
  const { data, isLoading, error } = useQuery({
    queryKey: qk.Property.stats(propertyId),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (propertyId) {
        params.append('propertyId', propertyId);
      }

      const response = await fetch(`/api/properties/stats?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch property stats');
      }

      return response.json();
    },
    staleTime: 0, // Toujours rafraîchir pour les stats
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  return {
    totalProperties: data?.totalProperties || 0,
    occupied: data?.occupied || 0,
    vacant: data?.vacant || 0,
    totalMonthlyRent: data?.totalMonthlyRent || 0,
    isLoading,
    error: error instanceof Error ? error.message : undefined,
  };
}

