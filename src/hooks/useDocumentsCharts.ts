import { useState, useEffect } from 'react';
import type { MonthlyDocumentData } from '@/components/documents/DocumentsMonthlyChart';
import type { DocumentTypeData } from '@/components/documents/DocumentsByTypeChart';
import type { LinksDistributionData } from '@/components/documents/DocumentsLinksDistributionChart';

interface UseDocumentsChartsParams {
  periodStart?: string; // Format: 'YYYY-MM'
  periodEnd?: string; // Format: 'YYYY-MM'
  refreshKey?: number; // Pour forcer le rafraîchissement
  propertyId?: string; // Pour filtrer par bien
}

export interface DocumentsChartsData {
  monthly: MonthlyDocumentData[];
  byType: DocumentTypeData[];
  linksDistribution: LinksDistributionData;
}

export function useDocumentsCharts(params: UseDocumentsChartsParams = {}) {
  const [data, setData] = useState<DocumentsChartsData>({
    monthly: [],
    byType: [],
    linksDistribution: { noLinks: 0, oneLink: 0, twoLinks: 0, threeOrMore: 0 },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchCharts = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams();
        
        if (params.periodStart) queryParams.append('periodStart', params.periodStart);
        if (params.periodEnd) queryParams.append('periodEnd', params.periodEnd);
        if (params.propertyId) queryParams.append('propertyId', params.propertyId);

        const response = await fetch(`/api/documents/charts?${queryParams.toString()}`);
        
        if (!response.ok) {
          throw new Error('Erreur lors du chargement des graphiques');
        }

        const responseData = await response.json();
        setData(responseData);
      } catch (err) {
        console.error('Erreur lors du chargement des graphiques:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCharts();
  }, [
    params.periodStart,
    params.periodEnd,
    params.refreshKey,
    params.propertyId,
  ]);

  return { data, isLoading, error };
}

