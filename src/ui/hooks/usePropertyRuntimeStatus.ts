'use client';

import { useQuery } from '@tanstack/react-query';
import { qk } from '../../lib/queryKeys';

export type PropertyRuntimeStatus = 'rented' | 'vacant' | 'work';

export interface PropertyStatusInfo {
  status: PropertyRuntimeStatus;
  label: string;
  color: string;
  hasActiveLease: boolean;
  activeLeasesCount: number;
}

export function usePropertyRuntimeStatus(propertyId: string, options?: { enabled?: boolean }): PropertyStatusInfo {
  const { data: leaseStats } = useQuery({
    queryKey: qk.Lease.stats(propertyId),
    queryFn: async () => {
      const response = await fetch(`/api/leases/stats?propertyId=${propertyId}`);
      if (!response.ok) {
        throw new Error('Erreur lors du chargement des stats de baux');
      }
      return response.json();
    },
    staleTime: 30 * 1000, // 30 secondes
    refetchOnWindowFocus: true,
    enabled: options?.enabled !== false && !!propertyId,
  });

  // Calcul du statut automatique basé sur les baux actifs
  const hasActiveLease = (leaseStats?.activeLeases || 0) > 0;
  const activeLeasesCount = leaseStats?.activeLeases || 0;

  // Logique de statut automatique
  let status: PropertyRuntimeStatus;
  let label: string;
  let color: string;

  if (hasActiveLease) {
    status = 'rented';
    label = 'Occupé';
    color = 'bg-green-100 text-green-800';
  } else {
    // TODO: Ajouter logique pour détecter travaux si nécessaire
    status = 'vacant';
    label = 'Vacant';
    color = 'bg-base-200 text-base-content';
  }

  return {
    status,
    label,
    color,
    hasActiveLease,
    activeLeasesCount,
  };
}
