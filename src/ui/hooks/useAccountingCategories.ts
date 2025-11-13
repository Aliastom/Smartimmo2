'use client';

import { useQuery } from '@tanstack/react-query';

interface AccountingCategory {
  id: string;
  slug: string;
  label: string;
  type: 'REVENU' | 'DEPENSE' | 'NON_DEFINI';
  deductible: boolean;
  capitalizable: boolean;
  actif: boolean;
}

interface UseAccountingCategoriesParams {
  type?: 'REVENU' | 'DEPENSE' | 'NON_DEFINI';
  nature?: string; // Nature pour filtrer
  active?: boolean;
}

export function useAccountingCategories(params: UseAccountingCategoriesParams = {}) {
  const { type, nature, active = true } = params;

  return useQuery<AccountingCategory[]>({
    queryKey: ['accounting-categories', { type, nature, active }],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (type) searchParams.append('type', type);
      if (nature) searchParams.append('nature', nature);
      if (active !== undefined) searchParams.append('active', active ? '1' : '0');

      const response = await fetch(`/api/accounting-categories?${searchParams.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch accounting categories');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Export de l'interface pour utilisation dans d'autres composants
export type { AccountingCategory };

