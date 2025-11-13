'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { onTenantChanged } from '../../lib/invalidate';
import { qk } from '../../lib/queryKeys';

export interface TenantsByPropertyParams {
  propertyId: string;
  activeOnly?: boolean;
}

export interface TenantFilters {
  hasActiveLeases?: boolean;
}

export interface TenantSearchParams {
  filters?: TenantFilters;
  search?: string;
  page?: number;
  limit?: number;
}

export interface Tenant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate?: string;
  nationality?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    leases: number;
  };
}

export interface CreateTenantData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate?: string;
  nationality?: string;
  notes?: string;
}

export interface UpdateTenantData extends Partial<CreateTenantData> {
  id: string;
}

// Hook pour récupérer les locataires d'une propriété spécifique
export function useTenantsByProperty(params: TenantsByPropertyParams) {
  const { propertyId, activeOnly = false } = params;
  
  return useQuery({
    queryKey: ['tenants', 'byProperty', { propertyId, activeOnly }],
    queryFn: async () => {
      if (!propertyId) {
        throw new Error('PropertyId requis pour charger les locataires');
      }
      
      const response = await fetch(`/api/tenants/by-property?propertyId=${propertyId}&activeOnly=${activeOnly}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
        throw new Error(`Impossible de charger les locataires : ${errorData.error || 'Erreur inconnue'}`);
      }
      const data = await response.json();
      return data.tenants || [];
    },
    staleTime: 30000, // 30 secondes
    refetchOnWindowFocus: true,
  });
}

// Hook pour récupérer les locataires
export function useTenants(params: TenantSearchParams = {}) {
  const { filters = {}, search = '', page = 1, limit = 10 } = params;
  
  return useQuery({
    queryKey: ['tenants', filters, search, page, limit],
    queryFn: async (): Promise<{ tenants: Tenant[]; total: number; pages: number }> => {
      const response = await fetch('/api/tenants');
      if (!response.ok) {
        throw new Error('Erreur lors du chargement des locataires');
      }
      const tenants = await response.json();
      return { tenants, total: tenants.length, pages: 1 };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook pour créer un locataire
export function useCreateTenant() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateTenantData): Promise<Tenant> => {
      const response = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Erreur lors de la création du locataire';
        try {
          const error = JSON.parse(errorText);
          errorMessage = error.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      const responseText = await response.text();
      if (!responseText) {
        throw new Error('Réponse vide du serveur');
      }
      
      return JSON.parse(responseText);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.tenants.list });
      await queryClient.invalidateQueries({ queryKey: ['tenants'] }); // Anciennes clés
      await queryClient.invalidateQueries({ queryKey: ['tenant-stats'] });
      await queryClient.invalidateQueries({ queryKey: qk.dashboard.summary });
      toast.success('Locataire créé avec succès');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Hook pour mettre à jour un locataire
export function useUpdateTenant() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: UpdateTenantData): Promise<Tenant> => {
      const { id, ...updateData } = data;
      const response = await fetch(`/api/tenants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Erreur lors de la mise à jour du locataire';
        try {
          const error = JSON.parse(errorText);
          errorMessage = error.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      const responseText = await response.text();
      if (!responseText) {
        throw new Error('Réponse vide du serveur');
      }
      
      return JSON.parse(responseText);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.tenants.list });
      await queryClient.invalidateQueries({ queryKey: ['tenants'] }); // Anciennes clés
      await queryClient.invalidateQueries({ queryKey: ['tenant-stats'] });
      await queryClient.invalidateQueries({ queryKey: qk.dashboard.summary });
      toast.success('Locataire mis à jour avec succès');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Hook pour supprimer un locataire
export function useDeleteTenant() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string): Promise<{ status: number; payload?: any }> => {
      const response = await fetch(`/api/tenants/${id}`, {
        method: 'DELETE',
      });
      
      if (response.status === 409) {
        const payload = await response.json();
        return { status: 409, payload };
      }
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erreur lors de la suppression du locataire');
      }
      
      return { status: 204 };
    },
    onMutate: async (id: string) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['tenants'] });
      
      const previousTenants = queryClient.getQueriesData({ queryKey: ['tenants'] });
      
      queryClient.setQueriesData({ queryKey: ['tenants'] }, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          tenants: old.tenants.filter((tenant: Tenant) => tenant.id !== id),
          total: old.total - 1,
        };
      });
      
      return { previousTenants };
    },
    onError: (error: Error, id: string, context: any) => {
      // Rollback on error
      if (context?.previousTenants) {
        context.previousTenants.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error(error.message);
    },
    onSuccess: (result) => {
      if (result.status === 204) {
        toast.success('Locataire supprimé avec succès');
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.tenants.list });
      await queryClient.invalidateQueries({ queryKey: ['tenants'] }); // Anciennes clés
      await queryClient.invalidateQueries({ queryKey: ['tenant-stats'] });
      await queryClient.invalidateQueries({ queryKey: qk.dashboard.summary });
    },
  });
}
