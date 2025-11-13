'use client';

import { useState, useEffect, useCallback } from 'react';

interface DocumentType {
  id: string;
  label: string;
  code: string;
  description?: string;
  isActive: boolean;
}

export function useDocumentTypes() {
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTypes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/document-types');
      
      if (!response.ok) {
        throw new Error('Failed to fetch document types');
      }

      const data = await response.json();
      setTypes(data.types || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching document types:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  return {
    types,
    loading,
    error,
    refetch: fetchTypes,
  };
}
