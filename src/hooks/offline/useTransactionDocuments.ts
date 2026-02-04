/**
 * Hook React pour récupérer les documents liés à une transaction
 * En mode App Shell, lit UNIQUEMENT depuis IndexedDB
 */

import { useState, useEffect } from 'react';
import { 
  getLinkedDocumentsForTransaction, 
  getDocumentCountForTransaction,
  hasDocumentForTransaction,
  type LinkedDocument 
} from '@/lib/offline/services/documentLinksService';
import { useCurrentOrganization } from './useCurrentOrganization';
import { getLocalDB } from '@/lib/offline/db';

export interface UseTransactionDocumentsResult {
  documents: LinkedDocument[];
  count: number;
  hasDocument: boolean;
  loading: boolean;
  error: string | null;
  // État pour détecter les documents manquants (liens présents mais métadonnées absentes)
  hasMissingDocuments: boolean;
}

/**
 * Hook pour récupérer les documents liés à une transaction
 * @param transactionId ID de la transaction
 * @param enabled Si false, ne charge pas les données (par défaut: true)
 */
export function useTransactionDocuments(
  transactionId: string | null | undefined,
  enabled: boolean = true
): UseTransactionDocumentsResult {
  const { organizationId } = useCurrentOrganization();
  const [documents, setDocuments] = useState<LinkedDocument[]>([]);
  const [count, setCount] = useState(0);
  const [hasDocument, setHasDocument] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMissingDocuments, setHasMissingDocuments] = useState(false);

  useEffect(() => {
    if (!enabled || !transactionId || !organizationId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadDocuments() {
      try {
        setLoading(true);
        setError(null);

        // Récupérer les documents (qui détecte aussi les manquants)
        const [docs, docCount, hasDoc] = await Promise.all([
          getLinkedDocumentsForTransaction(transactionId, organizationId),
          getDocumentCountForTransaction(transactionId, organizationId),
          hasDocumentForTransaction(transactionId, organizationId),
        ]);

        if (!cancelled) {
          setDocuments(docs);
          setCount(docCount);
          setHasDocument(hasDoc);
          
          // Détecter les documents manquants via la propriété cachée
          const missingIds = (docs as any).__missingDocumentIds || [];
          setHasMissingDocuments(missingIds.length > 0);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Erreur lors du chargement des documents');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDocuments();

    return () => {
      cancelled = true;
    };
  }, [transactionId, organizationId, enabled]);

  // Écouter les événements de refresh
  useEffect(() => {
    if (!enabled || !transactionId || !organizationId) {
      return;
    }

    const handleRefresh = async () => {
      try {
        const [docs, docCount, hasDoc] = await Promise.all([
          getLinkedDocumentsForTransaction(transactionId, organizationId),
          getDocumentCountForTransaction(transactionId, organizationId),
          hasDocumentForTransaction(transactionId, organizationId),
        ]);

        setDocuments(docs);
        setCount(docCount);
        setHasDocument(hasDoc);
      } catch (err: any) {
        // Erreur silencieuse lors du refresh
        console.error('Error refreshing transaction documents:', err);
      }
    };

    window.addEventListener('sync:refresh', handleRefresh);
    window.addEventListener('documents:refresh', handleRefresh);
    window.addEventListener('transactions:refresh', handleRefresh);

    return () => {
      window.removeEventListener('sync:refresh', handleRefresh);
      window.removeEventListener('documents:refresh', handleRefresh);
      window.removeEventListener('transactions:refresh', handleRefresh);
    };
  }, [transactionId, organizationId, enabled]);

  return {
    documents,
    count,
    hasDocument,
    loading,
    error,
    hasMissingDocuments,
  };
}

/**
 * Hook pour récupérer les documents de plusieurs transactions (optimisation)
 * @param transactionIds Liste des IDs de transactions
 * @param enabled Si false, ne charge pas les données (par défaut: true)
 */
export function useTransactionsDocuments(
  transactionIds: string[],
  enabled: boolean = true
) {
  const { organizationId } = useCurrentOrganization();
  const [documentsMap, setDocumentsMap] = useState<Map<string, LinkedDocument[]>>(new Map());
  const [countsMap, setCountsMap] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || transactionIds.length === 0 || !organizationId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadDocuments() {
      try {
        setLoading(true);
        setError(null);

        const { getLinkedDocumentsForTransactions, getDocumentCountsForTransactions } = await import('@/lib/offline/services/documentLinksService');
        
        const [docsMap, countsMap] = await Promise.all([
          getLinkedDocumentsForTransactions(transactionIds, organizationId),
          getDocumentCountsForTransactions(transactionIds, organizationId),
        ]);

        if (!cancelled) {
          setDocumentsMap(docsMap);
          setCountsMap(countsMap);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Erreur lors du chargement des documents');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDocuments();

    return () => {
      cancelled = true;
    };
  }, [transactionIds.join(','), organizationId, enabled]);

  // Écouter les événements de refresh
  useEffect(() => {
    if (!enabled || transactionIds.length === 0 || !organizationId) {
      return;
    }

    const handleRefresh = async () => {
      try {
        const { getLinkedDocumentsForTransactions, getDocumentCountsForTransactions } = await import('@/lib/offline/services/documentLinksService');
        
        const [docsMap, countsMap] = await Promise.all([
          getLinkedDocumentsForTransactions(transactionIds, organizationId),
          getDocumentCountsForTransactions(transactionIds, organizationId),
        ]);

        setDocumentsMap(docsMap);
        setCountsMap(countsMap);
      } catch (err: any) {
        console.error('Error refreshing transactions documents:', err);
      }
    };

    window.addEventListener('sync:refresh', handleRefresh);
    window.addEventListener('documents:refresh', handleRefresh);
    window.addEventListener('transactions:refresh', handleRefresh);

    return () => {
      window.removeEventListener('sync:refresh', handleRefresh);
      window.removeEventListener('documents:refresh', handleRefresh);
      window.removeEventListener('transactions:refresh', handleRefresh);
    };
  }, [transactionIds.join(','), organizationId, enabled]);

  return {
    documentsMap,
    countsMap,
    loading,
    error,
    // Helpers
    getDocuments: (transactionId: string) => documentsMap.get(transactionId) || [],
    getCount: (transactionId: string) => countsMap.get(transactionId) || 0,
    hasDocument: (transactionId: string) => (countsMap.get(transactionId) || 0) > 0,
  };
}









