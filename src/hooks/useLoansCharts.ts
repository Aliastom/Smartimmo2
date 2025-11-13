import { useQuery } from '@tanstack/react-query';

interface LoansChartsParams {
  from?: string;
  to?: string;
  propertyId?: string;
}

export function useLoansCharts(params: LoansChartsParams = {}) {
  return useQuery({
    queryKey: ['loans-charts', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.from) searchParams.append('from', params.from);
      if (params.to) searchParams.append('to', params.to);
      if (params.propertyId) searchParams.append('propertyId', params.propertyId);
      
      const response = await fetch(`/api/loans/charts?${searchParams.toString()}`);
      if (!response.ok) {
        throw new Error('Erreur lors du chargement des graphiques');
      }
      return response.json();
    },
    staleTime: 30000,
  });
}

