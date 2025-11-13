import { useState, useEffect } from 'react';

interface UseTransactionsTableProps {
  context: 'global' | 'property';
  propertyId?: string;
  initialQuery?: {
    dateFrom?: string;
    dateTo?: string;
    category?: string;
    q?: string;
  };
}

export function useTransactionsTable({
  context,
  propertyId,
  initialQuery = {},
}: UseTransactionsTableProps) {
  const [payments, setPayments] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState(initialQuery);

  useEffect(() => {
    fetchPayments();
  }, [context, propertyId, filters]);

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      
      if (context === 'property' && propertyId) {
        params.append('propertyId', propertyId);
      }
      
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.Category) params.append('category', filters.Category);
      if (filters.q) params.append('q', filters.q);

      const res = await fetch(`/api/payments?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPayments(data.items || []);
        setTotal(data.total || 0);
        setCount(data.count || 0);
      }
    } catch (error) {
      console.error('[useTransactionsTable] Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshPayments = () => {
    fetchPayments();
  };

  return {
    payments,
    total,
    count,
    isLoading,
    filters,
    setFilters,
    refreshPayments,
  };
}

