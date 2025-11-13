'use client';

import { useQuery } from '@tanstack/react-query';

export interface OccupancyPeriod {
  id: string;
  startDate: string;
  endDate?: string;
  monthlyRent: number;
  leaseId?: string;
}

export interface OccupancyHistoryItem {
  Tenant: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  periods: OccupancyPeriod[];
}

export function useOccupancyHistory(propertyId?: string) {
  return useQuery({
    queryKey: ['occupancy-history', propertyId],
    queryFn: async (): Promise<OccupancyHistoryItem[]> => {
      if (!propertyId) {
        return [];
      }

      const response = await fetch(`/api/occupancy-history?propertyId=${propertyId}`);
      if (!response.ok) {
        throw new Error('Erreur lors du chargement de l\'historique');
      }
      const data = await response.json();
      return data.history || [];
    },
    enabled: !!propertyId,
    staleTime: 60000, // 1 minute
  });
}

