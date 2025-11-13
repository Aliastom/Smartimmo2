import { useState, useEffect } from 'react';
import type { MonthlyRentData, YearlyRentData } from '@/components/leases/LeasesRentEvolutionChart';
import type { FurnishedData } from '@/components/leases/LeasesByFurnishedChart';
import type { DepositsRentsData } from '@/components/leases/LeasesDepositsRentsChart';

interface UseLeasesChartsParams {
  propertyId?: string;
  refreshKey?: number; // Pour forcer le rafraîchissement
}

export interface LeasesChartsData {
  rentEvolution: {
    monthly: MonthlyRentData[];
    yearly: YearlyRentData[];
  };
  byFurnished: FurnishedData[];
  depositsRents: DepositsRentsData;
}

export function useLeasesCharts(params: UseLeasesChartsParams = {}) {
  const [data, setData] = useState<LeasesChartsData>({
    rentEvolution: {
      monthly: [],
      yearly: [],
    },
    byFurnished: [],
    depositsRents: {
      totalDeposits: 0,
      monthlyTotal: 0,
      yearlyTotal: 0,
    },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchCharts = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams();
        
        if (params.propertyId) queryParams.append('propertyId', params.propertyId);

        const response = await fetch(`/api/leases/charts?${queryParams.toString()}`);
        
        if (!response.ok) {
          throw new Error('Erreur lors du chargement des graphiques des baux');
        }

        const responseData = await response.json();
        setData(responseData);
      } catch (err) {
        console.error('Erreur lors du chargement des graphiques des baux:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCharts();
  }, [
    params.propertyId,
    params.refreshKey,
  ]);

  return { data, isLoading, error };
}

