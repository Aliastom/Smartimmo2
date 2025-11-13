import { useQuery } from '@tanstack/react-query';

interface LoansKpisParams {
  from?: string;
  to?: string;
  propertyId?: string;
}

export function useLoansKpis(params: LoansKpisParams = {}) {
  return useQuery({
    queryKey: ['loans-kpis', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.from) searchParams.append('from', params.from);
      if (params.to) searchParams.append('to', params.to);
      if (params.propertyId) searchParams.append('propertyId', params.propertyId);
      
      const response = await fetch(`/api/loans?${searchParams.toString()}`);
      if (!response.ok) {
        throw new Error('Erreur lors du chargement des KPIs');
      }
      const data = await response.json();
      return data.kpis;
    },
    staleTime: 30000, // 30 secondes
  });
}

