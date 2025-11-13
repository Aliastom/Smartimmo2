import { useState, useEffect, useMemo, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DocumentSearchInput, DocumentDetail } from '@/types/documents';

// Types pour l'administration des types de documents
export interface AdminDocumentType {
  id: string;
  code: string;
  label: string;
  icon: string | null;
  color: string | null;
  description: string | null;
  isSystem: boolean;
  isSensitive: boolean;
  isActive: boolean;
  defaultContexts: string[];
  suggestionConfig: any;
  order: number;
}

interface UseDocumentsResult {
  documents: any[];
  loading: boolean;
  error: string | null;
  total: number;
  hasMore: boolean;
  refetch: () => void;
  fetchMore: () => void;
}

export function useDocuments(filters: Partial<DocumentSearchInput> = {}): UseDocumentsResult {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Mémoriser les filtres pour éviter les changements de référence
  const stableFilters = useMemo(() => filters, [
    filters.query,
    filters.type,
    filters.propertyId,
    filters.leaseId,
    filters.tenantId,
    filters.transactionId,
    filters.loanId,
    filters.includeDeleted,
    filters.limit,
  ]);
  
  const limit = stableFilters.limit || 50;

  useEffect(() => {
    let isCancelled = false;
    
    const fetchDocuments = async () => {
      try {
        setLoading(true);
        setError(null);

        // Construire les query params
        const params = new URLSearchParams();
        
        Object.entries({ ...stableFilters, offset: 0, limit }).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            if (Array.isArray(value)) {
              params.append(key, value.join(','));
            } else {
              params.append(key, String(value));
            }
          }
        });

        const response = await fetch(`/api/documents?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch documents');
        }

        const data = await response.json();
        
        if (!isCancelled) {
          setDocuments(data.documents);
          setTotal(data.pagination.total);
          setOffset(0);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err.message);
          console.error('Error fetching documents:', err);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchDocuments();
    
    return () => {
      isCancelled = true;
    };
  }, [stableFilters, limit, refreshKey]);

  const refetch = () => {
    setRefreshKey(prev => prev + 1);
  };

  const fetchMore = async () => {
    const nextOffset = offset + limit;
    if (nextOffset >= total || loading) return;

    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      Object.entries({ ...stableFilters, offset: nextOffset, limit }).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            params.append(key, value.join(','));
          } else {
            params.append(key, String(value));
          }
        }
      });

      const response = await fetch(`/api/documents?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch more documents');
      }

      const data = await response.json();
      
      setDocuments(prev => [...prev, ...data.documents]);
      setOffset(nextOffset);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching more documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const hasMore = offset + limit < total;

  return {
    documents,
    loading,
    error,
    total,
    hasMore,
    refetch,
    fetchMore,
  };
}

export function useDocument(id: string | null) {
  const [document, setDocument] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocument = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/documents/${id}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch document');
      }

      const data = await response.json();
      setDocument(data);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching document:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  const refetch = fetchDocument;

  return {
    document,
    loading,
    error,
    refetch,
  };
}

// Hooks pour l'administration des types de documents

export function useAdminDocumentTypes({ includeInactive = false }: { includeInactive?: boolean } = {}) {
  return useQuery({
    queryKey: ['admin', 'document-types', { includeInactive }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (includeInactive) {
        params.append('includeInactive', 'true');
      }
      const response = await fetch(`/api/admin/document-types?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch document types');
      }
      return response.json();
    },
  });
}

export function useCreateDocumentType() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Partial<AdminDocumentType>) => {
      const response = await fetch('/api/admin/document-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create document type');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'document-types'] });
    },
  });
}

export function useUpdateDocumentType() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AdminDocumentType> }) => {
      const response = await fetch(`/api/admin/document-types/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update document type');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'document-types'] });
    },
  });
}

export function useDeleteDocumentType() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/document-types/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete document type');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'document-types'] });
    },
  });
}
