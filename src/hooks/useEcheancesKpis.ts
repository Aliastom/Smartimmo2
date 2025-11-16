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
      const response = await fetch('/api/echeances/kpis', {
        credentials: 'include', // Inclure les cookies pour l'authentification
      });
      if (!response.ok) {
        throw new Error('Erreur lors du chargement des KPIs');
      }
      return response.json();
    },
    staleTime: 0, // Pas de cache pour éviter les problèmes de multi-tenancy
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

