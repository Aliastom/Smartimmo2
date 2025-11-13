import { useState, useCallback } from 'react';

interface UploadProgress {
  documentId?: string;
  filename: string;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'success' | 'error';
  error?: string;
}

interface UseDocumentUploadOptions {
  propertyId?: string;
  leaseId?: string;
  tenantId?: string;
  transactionId?: string;
  loanId?: string;
  tags?: string[];
  onSuccess?: (documentIds: string[]) => void;
  onError?: (error: string) => void;
}

export function useDocumentUpload(options: UseDocumentUploadOptions = {}) {
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const upload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    setIsUploading(true);

    // Initialiser le suivi des uploads
    const initialProgress: UploadProgress[] = files.map(file => ({
      filename: file.name,
      progress: 0,
      status: 'pending',
    }));
    setUploads(initialProgress);

    try {
      const formData = new FormData();
      
      files.forEach(file => {
        formData.append('files', file);
      });

      // Ajouter les métadonnées
      if (options.propertyId) formData.append('propertyId', options.propertyId);
      if (options.leaseId) formData.append('leaseId', options.leaseId);
      if (options.tenantId) formData.append('tenantId', options.tenantId);
      if (options.transactionId) formData.append('transactionId', options.transactionId);
      if (options.loanId) formData.append('loanId', options.loanId);
      if (options.tags) formData.append('tags', JSON.stringify(options.tags));

      // Mettre à jour le statut
      setUploads(prev => prev.map(u => ({ ...u, status: 'uploading', progress: 50 })));

      const response = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();

      // Mettre à jour avec les résultats
      const finalProgress = data.documents.map((doc: any, index: number) => ({
        documentId: doc.id,
        filename: doc.filename,
        progress: 100,
        status: doc.isDuplicate ? 'success' : 'processing',
      }));

      setUploads(finalProgress);

      // Callback de succès
      if (options.onSuccess) {
        const documentIds = data.documents.map((d: any) => d.id);
        options.onSuccess(documentIds);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      
      // Marquer tous les uploads comme échoués
      setUploads(prev => prev.map(u => ({
        ...u,
        status: 'error',
        error: error.message,
      })));

      if (options.onError) {
        options.onError(error.message);
      }
    } finally {
      setIsUploading(false);
    }
  }, [options]);

  const reset = useCallback(() => {
    setUploads([]);
    setIsUploading(false);
  }, []);

  return {
    upload,
    uploads,
    isUploading,
    reset,
  };
}

