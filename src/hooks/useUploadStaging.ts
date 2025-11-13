import { useState, useEffect, useCallback } from 'react';

interface StagedDocument {
  id: string;
  name: string;
  status: 'draft';
  type: string;
  size: number;
  mime: string;
  intendedContext: {
    type: string;
    tempKey?: string;
  };
  uploadedAt: string;
}

interface UploadSession {
  id: string;
  createdAt: string;
  expiresAt: string;
}

export const useUploadStaging = () => {
  const [uploadSessionId, setUploadSessionId] = useState<string | null>(null);
  const [stagedDocuments, setStagedDocuments] = useState<StagedDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Créer une nouvelle session d'upload avec contexte optionnel
  const createUploadSession = useCallback(async (options?: { 
    scope?: 'transaction:new' | 'transaction:edit' | 'global';
    transactionId?: string;
  }) => {
    console.log('[useUploadStaging] createUploadSession appelé avec options:', options);
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/uploads/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options || {})
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('[useUploadStaging] Session créée:', result.uploadSessionId);
        setUploadSessionId(result.uploadSessionId);
        return result.uploadSessionId;
      } else {
        throw new Error(result.error || 'Erreur lors de la création de la session');
      }
    } catch (err: any) {
      console.error('[useUploadStaging] Erreur création session:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Charger les documents d'une session
  const loadStagedDocuments = useCallback(async (sessionId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/uploads/session/${sessionId}`);
      const result = await response.json();
      
      if (result.success) {
        // L'API retourne maintenant 'drafts' au lieu de 'documents'
        setStagedDocuments(result.drafts || []);
        console.log('[useUploadStaging] Documents chargés:', result.drafts?.length || 0);
        return result.drafts || [];
      } else {
        throw new Error(result.error || 'Erreur lors du chargement des documents');
      }
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Ajouter un document en staging
  const addStagedDocument = useCallback((document: StagedDocument) => {
    setStagedDocuments(prev => [...prev, document]);
  }, []);

  // Supprimer un document en staging
  const removeStagedDocument = useCallback(async (documentId: string) => {
    try {
      const response = await fetch(`/api/uploads/staged/${documentId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        setStagedDocuments(prev => prev.filter(doc => doc.id !== documentId));
        return true;
      } else {
        throw new Error(result.error || 'Erreur lors de la suppression');
      }
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, []);

  // Supprimer une session complète
  const deleteUploadSession = useCallback(async (sessionId?: string) => {
    const idToDelete = sessionId || uploadSessionId;
    if (!idToDelete) return true; // Pas de session à supprimer
    try {
      const response = await fetch(`/api/uploads/session/${idToDelete}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        setUploadSessionId(null);
        setStagedDocuments([]);
        return true;
      } else {
        throw new Error(result.error || 'Erreur lors de la suppression de la session');
      }
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, []);

  // L'initialisation est maintenant manuelle (appelée depuis le composant)

  // Nettoyer complètement le staging
  const clearStaging = useCallback(async () => {
    console.log('[useUploadStaging] clearStaging appelé, uploadSessionId:', uploadSessionId);
    
    // Supprimer la session de la base de données si elle existe
    if (uploadSessionId) {
      try {
        console.log('[useUploadStaging] Suppression de la session:', uploadSessionId);
        await deleteUploadSession();
        console.log('[useUploadStaging] Session supprimée avec succès');
      } catch (err) {
        console.warn('Erreur lors de la suppression de la session:', err);
      }
    } else {
      console.log('[useUploadStaging] Aucune session à supprimer');
    }
    
    // Nettoyer l'état local
    setUploadSessionId(null);
    setStagedDocuments([]);
    setError(null);
    console.log('[useUploadStaging] État local nettoyé');
  }, [uploadSessionId, deleteUploadSession]);

  return {
    uploadSessionId,
    stagedDocuments,
    setStagedDocuments,
    loading,
    error,
    createUploadSession,
    loadStagedDocuments,
    addStagedDocument,
    removeStagedDocument,
    deleteUploadSession,
    clearStaging
  };
};
