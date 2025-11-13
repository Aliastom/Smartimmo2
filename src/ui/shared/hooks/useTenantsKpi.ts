'use client';

import { useQuery } from '@tanstack/react-query';

interface TenantsKpiFilters {
  propertyId?: string;
}

interface TenantsKpiData {
  totalTenants: number;
  activeTenants: number;
  inactiveTenants: number;
}

export function useTenantsKpi(filters: TenantsKpiFilters = {}) {
  return useQuery({
    queryKey: ['tenants-kpi', filters],
    queryFn: async (): Promise<TenantsKpiData> => {
      const params = new URLSearchParams();
      if (filters.propertyId) {
        params.append('propertyId', filters.propertyId);
      }
      
      const response = await fetch(`/api/tenants/kpi?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch tenants KPI');
      }
      
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
