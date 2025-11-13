import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface Document {
  id: string;
  fileName: string;
  mime: string;
  url: string;
  size: number;
  docType: 'invoice' | 'receipt' | 'lease' | 'loan' | 'tax' | 'photo' | 'other';
  propertyId?: string;
  transactionId?: string;
  leaseId?: string;
  loanId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentFilters {
  docType?: string;
  propertyId?: string;
  transactionId?: string;
  leaseId?: string;
  loanId?: string;
  q?: string;
}

export function useDocuments(filters: DocumentFilters = {}) {
  return useQuery({
    queryKey: ['documents', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await fetch(`/api/documents?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Erreur lors du chargement des documents');
      }
      const data = await response.json();
      return data.items || [];
    },
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch('/api/documents', {
        method: 'POST',
        body: data,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la création du document');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      toast.success('Document créé avec succès');
      
      // Invalider les queries liées aux documents
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      
      // Invalider les queries de propriété si propertyId est présent
      const propertyId = variables.get('propertyId');
      if (propertyId) {
        queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
        queryClient.invalidateQueries({ queryKey: ['property-stats'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Document> }) => {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la mise à jour du document');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast.success('Document mis à jour avec succès');
      
      // Invalider les queries liées aux documents
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      
      // Invalider les queries de propriété si propertyId est présent
      if (data.propertyId) {
        queryClient.invalidateQueries({ queryKey: ['property', data.propertyId] });
        queryClient.invalidateQueries({ queryKey: ['property-stats'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la suppression du document');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast.success('Document supprimé avec succès');
      
      // Invalider les queries liées aux documents
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      
      // Invalider les queries de propriété si propertyId est présent
      if (data.propertyId) {
        queryClient.invalidateQueries({ queryKey: ['property', data.propertyId] });
        queryClient.invalidateQueries({ queryKey: ['property-stats'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Hook spécialisé pour les photos
export function usePhotos(propertyId?: string) {
  return useDocuments({ docType: 'photo', propertyId });
}

export function useCreatePhoto() {
  return useCreateDocument();
}

export function useDeletePhoto() {
  return useDeleteDocument();
}
