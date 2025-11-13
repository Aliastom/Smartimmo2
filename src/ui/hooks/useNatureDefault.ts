'use client';

import { useQuery } from '@tanstack/react-query';

interface NatureDefault {
  categoryId: string;
  slug: string;
  label: string;
}

export function useNatureDefault(nature: string) {
  return useQuery<NatureDefault | null>({
    queryKey: ['nature-default', nature],
    queryFn: async () => {
      if (!nature) return null;
      
      const response = await fetch(`/api/natures/${nature}/default`);
      if (!response.ok) {
        throw new Error('Failed to fetch nature default');
      }
      return response.json();
    },
    enabled: !!nature,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

