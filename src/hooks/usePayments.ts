import useSWR from 'swr';

interface PaymentFilters {
  propertyId?: string;
  leaseId?: string;
  year?: number;
  month?: number;
  dateFrom?: string;
  dateTo?: string;
  query?: string;
}

interface Payment {
  id: string;
  propertyId: string;
  leaseId: string | null;
  periodYear: number;
  periodMonth: number;
  date: string;
  amount: number;
  category: string;
  label: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
  Property: {
    id: string;
    name: string;
  };
  lease: {
    id: string;
    Tenant: {
      firstName: string;
      lastName: string;
    };
  } | null;
  attachments: Array<{
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    url: string;
  }>;
}

interface PaymentsResponse {
  items: Payment[];
  total: number;
  count: number;
}

const fetcher = async (url: string): Promise<PaymentsResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch payments');
  }
  return response.json();
};

export function usePayments(filters?: PaymentFilters) {
  // Construire l'URL uniquement avec les filtres définis
  const buildUrl = () => {
    const params = new URLSearchParams();
    
    if (filters?.propertyId) params.append('propertyId', filters.propertyId);
    if (filters?.leaseId) params.append('leaseId', filters.leaseId);
    if (filters?.year) params.append('y', filters.year.toString());
    if (filters?.month) params.append('m', filters.month.toString());
    if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.append('dateTo', filters.dateTo);
    if (filters?.query) params.append('q', filters.query);
    
    const queryString = params.toString();
    return `/api/payments${queryString ? `?${queryString}` : ''}`;
  };

  const url = buildUrl();
  
  const { data, error, isLoading, mutate } = useSWR<PaymentsResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  return {
    payments: data?.items ?? [],
    total: data?.total ?? 0,
    count: data?.count ?? 0,
    isLoading,
    isError: error,
    mutate,
  };
}

