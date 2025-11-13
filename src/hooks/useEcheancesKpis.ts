import { useQuery } from '@tanstack/react-query';

export interface EcheanceKpis {
  revenusAnnuels: number;
  chargesAnnuelles: number;
  totalEcheances: number;
  echeancesActives: number;
}

/**
 * Hook pour récupérer les KPIs des échéances récurrentes
 * Calcul annuel basé sur la périodicité
 */
export function useEcheancesKpis() {
  return useQuery<EcheanceKpis>({
    queryKey: ['echeances-kpis'],
    queryFn: async () => {
      const response = await fetch('/api/echeances/kpis');
      if (!response.ok) {
        throw new Error('Erreur lors du chargement des KPIs');
      }
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });
}

