import { useQuery } from '@tanstack/react-query';

export interface AccountingCategory {
  id: string;
  label: string;
  type: 'REVENU' | 'DEPENSE' | 'NON_DEFINI';
}

export interface AccountingMappingResponse {
  allowedCategories: AccountingCategory[];
  defaultCategoryId: string | null;
  hasRules: boolean;
}

export function useAccountingMapping(nature?: string) {
  return useQuery<AccountingMappingResponse>({
    queryKey: ['accounting-mapping', nature],
    queryFn: async () => {
      if (!nature) {
        return {
          allowedCategories: [],
          defaultCategoryId: null,
          hasRules: false,
        };
      }

      const response = await fetch(`/api/accounting/mapping?nature=${encodeURIComponent(nature)}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch accounting mapping');
      }
      
      return response.json();
    },
    enabled: !!nature,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
