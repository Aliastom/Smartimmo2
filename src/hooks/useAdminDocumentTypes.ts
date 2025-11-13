import { useState, useEffect, useCallback } from 'react';

interface DocumentTypeWithMeta {
  id: string;
  code: string;
  label: string;
  description?: string;
  isActive: boolean;
  autoAssignThreshold?: number;
  keywordsCount: number;
  signalsCount: number;
  rulesCount: number;
  createdAt: string;
  updatedAt: string;
}

interface UseAdminDocumentTypesResult {
  documentTypes: DocumentTypeWithMeta[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  createDocumentType: (data: any) => Promise<boolean>;
  updateDocumentType: (id: string, data: any) => Promise<boolean>;
  deleteDocumentType: (id: string) => Promise<boolean>;
}

export function useAdminDocumentTypes(includeInactive = false): UseAdminDocumentTypesResult {
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocumentTypes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (includeInactive) {
        params.set('includeInactive', 'true');
      }
      
      const response = await fetch(`/api/admin/document-types?${params.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        setDocumentTypes(data.data || []);
      } else {
        setError(data.error || 'Erreur lors du chargement');
      }
    } catch (err) {
      setError('Erreur de connexion');
      console.error('Error fetching document types:', err);
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => {
    fetchDocumentTypes();
  }, [fetchDocumentTypes]);

  const createDocumentType = useCallback(async (data: any): Promise<boolean> => {
    try {
      const response = await fetch('/api/admin/document-types', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      
      if (result.success) {
        await fetchDocumentTypes(); // Refresh the list
        return true;
      } else {
        setError(result.error || 'Erreur lors de la création');
        return false;
      }
    } catch (err) {
      setError('Erreur de connexion');
      console.error('Error creating document type:', err);
      return false;
    }
  }, [fetchDocumentTypes]);

  const updateDocumentType = useCallback(async (id: string, data: any): Promise<boolean> => {
    try {
      const response = await fetch(`/api/admin/document-types/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      
      if (result.success) {
        await fetchDocumentTypes(); // Refresh the list
        return true;
      } else {
        setError(result.error || 'Erreur lors de la mise à jour');
        return false;
      }
    } catch (err) {
      setError('Erreur de connexion');
      console.error('Error updating document type:', err);
      return false;
    }
  }, [fetchDocumentTypes]);

  const deleteDocumentType = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/admin/document-types/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      
      if (result.success) {
        await fetchDocumentTypes(); // Refresh the list
        return true;
      } else {
        setError(result.error || 'Erreur lors de la suppression');
        return false;
      }
    } catch (err) {
      setError('Erreur de connexion');
      console.error('Error deleting document type:', err);
      return false;
    }
  }, [fetchDocumentTypes]);

  return {
    documentTypes,
    loading,
    error,
    refetch: fetchDocumentTypes,
    createDocumentType,
    updateDocumentType,
    deleteDocumentType,
  };
}

// Export individual hooks for compatibility
export const useCreateDocumentType = (onSuccess?: () => void) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createDocumentType = useCallback(async (data: any) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/document-types', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      
      if (result.success) {
        onSuccess?.();
        return result.data;
      } else {
        setError(result.error || 'Erreur lors de la création');
        return null;
      }
    } catch (err) {
      setError('Erreur de connexion');
      console.error('Error creating document type:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);

  return { createDocumentType, loading, error };
};

export const useUpdateDocumentType = (onSuccess?: () => void) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateDocumentType = useCallback(async (id: string, data: any) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/document-types/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      
      if (result.success) {
        onSuccess?.();
        return result.data;
      } else {
        setError(result.error || 'Erreur lors de la mise à jour');
        return null;
      }
    } catch (err) {
      setError('Erreur de connexion');
      console.error('Error updating document type:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);

  return { updateDocumentType, loading, error };
};

export const useDeleteDocumentType = (onSuccess?: () => void) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteDocumentType = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/document-types/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      
      if (result.success) {
        onSuccess?.();
        return true;
      } else {
        setError(result.error || 'Erreur lors de la suppression');
        return false;
      }
    } catch (err) {
      setError('Erreur de connexion');
      console.error('Error deleting document type:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);

  return { deleteDocumentType, loading, error };
};
