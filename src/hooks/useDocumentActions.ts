import { useState, useCallback } from 'react';

interface ClassificationResult {
  typeId: string | null;
  confidence: number;
  label?: string;
  top3?: Array<{ code: string; label: string; confidence: number }>;
}

export function useDocumentActions() {
  const [loading, setLoading] = useState(false);
  const [classifyLoading, setClassifyLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateDocument = useCallback(async (documentId: string, data: any) => {
    try {
      setSaveLoading(true);
      setError(null);

      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update document');
      }

      return await response.json();
    } catch (err: any) {
      setError(err.message);
      console.error('Error updating document:', err);
      throw err;
    } finally {
      setSaveLoading(false);
    }
  }, []);

  const deleteDocument = useCallback(async (documentId: string, hard: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      const url = hard ? `/api/documents/${documentId}?hard=true` : `/api/documents/${documentId}`;
      
      const response = await fetch(url, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      return await response.json();
    } catch (err: any) {
      setError(err.message);
      console.error('Error deleting document:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reclassify = useCallback(async (documentId: string): Promise<ClassificationResult> => {
    try {
      setClassifyLoading(true);
      setError(null);

      const response = await fetch(`/api/documents/${documentId}/classify`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to reclassify document');
      }

      const result = await response.json();
      
      if (result.classification) {
        return {
          typeId: result.classification.typeId || null,
          confidence: result.classification.confidence || 0,
          label: result.classification.label,
          top3: result.classification.top3 || []
        };
      }
      
      return { typeId: null, confidence: 0, label: undefined, top3: [] };
    } catch (err: any) {
      setError(err.message);
      console.error('Error reclassifying document:', err);
      throw err;
    } finally {
      setClassifyLoading(false);
    }
  }, []);

  const reextract = useCallback(async (documentId: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/documents/${documentId}/extract`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to extract fields');
      }

      return await response.json();
    } catch (err: any) {
      setError(err.message);
      console.error('Error extracting fields:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createReminders = useCallback(async (documentId: string, auto: boolean = true) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/documents/${documentId}/reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto }),
      });

      if (!response.ok) {
        throw new Error('Failed to create reminders');
      }

      return await response.json();
    } catch (err: any) {
      setError(err.message);
      console.error('Error creating reminders:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const bulkOperation = useCallback(async (
    documentIds: string[],
    operation: 'delete' | 'update_type' | 'add_tags' | 'remove_tags' | 'restore',
    data?: any
  ) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/documents/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentIds,
          operation,
          data,
        }),
      });

      if (!response.ok) {
        throw new Error('Bulk operation failed');
      }

      return await response.json();
    } catch (err: any) {
      setError(err.message);
      console.error('Error in bulk operation:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    updateDocument,
    deleteDocument,
    reclassify,
    reextract,
    createReminders,
    bulkOperation,
    loading,
    classifyLoading,
    saveLoading,
    error,
  };
}