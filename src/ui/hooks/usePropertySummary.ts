'use client';

import { useQuery } from '@tanstack/react-query';

interface PropertySummary {
  Property: {
    id: string;
    name: string;
    address: string;
    acquisitionPrice: number;
    currentValue?: number;
    notaryFees?: number;
  };
  summary: {
    annualRentsCents: number;
    annualCashflowCents: number;
    grossYieldPct: number;
    annualExpensesCents: number;
    annualLoansCents: number;
    baseValue: number;
  };
}

export function usePropertySummary(propertyId: string) {
  return useQuery<PropertySummary>({
    queryKey: ['property-summary', propertyId],
    queryFn: async () => {
      const response = await fetch(`/api/properties/${propertyId}/summary`);
      if (!response.ok) {
        throw new Error('Erreur lors du chargement du résumé');
      }
      return response.json();
    },
    enabled: !!propertyId,
    staleTime: 30 * 1000, // 30 secondes
    refetchOnWindowFocus: true,
  });
}
