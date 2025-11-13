'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { onLeaseChanged } from '../../lib/invalidate';
import { qk } from '../../lib/queryKeys';

export interface LeaseFilters {
  propertyId?: string;
  type?: string;
  status?: string;
  year?: number;
  month?: number;
}

export interface LeaseSearchParams {
  filters?: LeaseFilters;
  search?: string;
  page?: number;
  limit?: number;
}

export interface Lease {
  id: string;
  propertyId: string;
  tenantId: string;
  type: string;
  status?: string; // Statut persistant en DB
  runtimeStatus?: 'active' | 'signed' | 'upcoming' | 'expired' | 'draft'; // Statut calculé
  startDate: string;
  endDate?: string;
  signedAt?: string; // Date de signature
  rentAmount: number;
  charges?: number;
  deposit?: number;
  paymentDay?: number;
  notes?: string;
  signedPdfUrl?: string;
  createdAt: string;
  updatedAt: string;
  property?: {
    id: string;
    name: string;
    address: string;
  };
  tenant?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface CreateLeaseData {
  propertyId: string;
  tenantId: string;
  type: string;
  startDate: string;
  endDate?: string;
  rentAmount: number;
  charges?: number;
  deposit?: number;
  paymentDay?: number;
  notes?: string;
}

export interface UpdateLeaseData extends Partial<CreateLeaseData> {
  id: string;
}

// Hook pour récupérer les baux
export function useLeases(params: LeaseSearchParams = {}) {
  const { filters = {}, search = '', page = 1, limit = 10 } = params;
  
  return useQuery({
    queryKey: filters.propertyId ? qk.Lease.listByProperty(filters.propertyId) : qk.Lease.list,
    queryFn: async (): Promise<{ leases: Lease[]; total: number; pages: number }> => {
      // Construire l'URL avec les paramètres
      const urlParams = new URLSearchParams();
      
      if (filters.propertyId) {
        urlParams.append('propertyId', filters.propertyId);
      }
      if (filters.status) {
        urlParams.append('status', filters.status);
      }
      if (filters.type) {
        urlParams.append('type', filters.type);
      }
      if (search) {
        urlParams.append('search', search);
      }
      if (page > 1) {
        urlParams.append('page', page.toString());
      }
      if (limit !== 10) {
        urlParams.append('limit', limit.toString());
      }
      
      const response = await fetch(`/api/leases?${urlParams.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
        throw new Error(`Impossible de charger les baux : ${errorData.error || 'Erreur inconnue'}`);
      }
      const data = await response.json();
      return { 
        leases: data.Lease || [], 
        total: data.total || data.Lease?.length || 0, 
        pages: data.pages || Math.ceil((data.total || data.Lease?.length || 0) / limit)
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook pour créer un bail
export function useCreateLease() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateLeaseData): Promise<Lease> => {
      const response = await fetch('/api/leases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Erreur lors de la création du bail';
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
    onSuccess: async (data) => {
      await onLeaseChanged(queryClient, data.propertyId);
      toast.success('Bail créé avec succès');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Hook pour mettre à jour un bail
export function useUpdateLease() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: UpdateLeaseData): Promise<Lease> => {
      const { id, ...updateData } = data;
      const response = await fetch(`/api/leases/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Erreur lors de la mise à jour du bail';
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
    onSuccess: async (data) => {
      await onLeaseChanged(queryClient, data.propertyId);
      toast.success('Bail mis à jour avec succès');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Hook pour supprimer un bail
export function useDeleteLease() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string): Promise<{ status: number; payload?: any }> => {
      const response = await fetch(`/api/leases/${id}`, {
        method: 'DELETE',
      });
      
      if (response.status === 409) {
        const payload = await response.json();
        return { status: 409, payload };
      }
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erreur lors de la suppression du bail');
      }
      
      return { status: 204 };
    },
    onMutate: async (id: string) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['leases'] });
      
      const previousLeases = queryClient.getQueriesData({ queryKey: ['leases'] });
      
      queryClient.setQueriesData({ queryKey: ['leases'] }, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          leases: old.Lease.filter((lease: Lease) => lease.id !== id),
          total: old.total - 1,
        };
      });
      
      return { previousLeases };
    },
    onError: (error: Error, id: string, context: any) => {
      // Rollback on error
      if (context?.previousLeases) {
        context.previousLeases.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error(error.message);
    },
    onSuccess: (result) => {
      if (result.status === 204) {
        toast.success('Bail supprimé avec succès');
      }
    },
    onSettled: async (data, error, id) => {
      // Invalider toutes les queries de baux car on ne connaît pas le propertyId
      await queryClient.invalidateQueries({ queryKey: qk.Lease.list });
      await queryClient.invalidateQueries({ queryKey: ['leases'] }); // Invalider aussi les anciennes clés
      await queryClient.invalidateQueries({ queryKey: ['lease-stats'] });
      await queryClient.invalidateQueries({ queryKey: qk.Property.list });
      await queryClient.invalidateQueries({ queryKey: qk.dashboard.summary });
    },
  });
}
