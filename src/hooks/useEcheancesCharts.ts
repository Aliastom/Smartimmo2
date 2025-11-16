import { useQuery } from '@tanstack/react-query';
import { CumulativeData } from '@/components/echeances/EcheancesCumulativeChart';
import { TypeData } from '@/components/echeances/EcheancesByTypeChart';
import { RecuperablesData } from '@/components/echeances/EcheancesRecuperablesChart';

export interface EcheancesChartsData {
  cumulative: CumulativeData[];
  byType: TypeData[];
  recuperables: RecuperablesData;
}

interface UseEcheancesChartsParams {
  periodStart: string; // YYYY-MM
  periodEnd: string; // YYYY-MM
  viewMode: 'monthly' | 'yearly';
  propertyId?: string;
}

export function useEcheancesCharts({
  periodStart,
  periodEnd,
  viewMode,
  propertyId,
}: UseEcheancesChartsParams) {
  return useQuery<EcheancesChartsData>({
    queryKey: ['echeances-charts', periodStart, periodEnd, viewMode, propertyId],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: periodStart,
        to: periodEnd,
        viewMode,
      });

      if (propertyId) {
        params.append('propertyId', propertyId);
      }

      const response = await fetch(`/api/echeances/charts?${params.toString()}`, {
        credentials: 'include', // Inclure les cookies pour l'authentification
      });
      if (!response.ok) {
        throw new Error('Erreur lors du chargement des graphiques');
      }
      return response.json();
    },
    staleTime: 0, // Pas de cache pour éviter les problèmes de multi-tenancy
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

