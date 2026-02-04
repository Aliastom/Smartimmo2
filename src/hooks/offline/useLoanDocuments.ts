/**
 * Hook React pour récupérer les documents liés à un prêt
 * En mode App Shell, lit UNIQUEMENT depuis IndexedDB
 */

import { useState, useEffect } from 'react';
import { 
  getLinkedDocumentsForLoan, 
  getDocumentCountForLoan,
  hasDocumentForLoan,
  type LinkedDocument 
} from '@/lib/offline/services/documentLinksService';
import { useCurrentOrganization } from './useCurrentOrganization';

export interface UseLoanDocumentsResult {
  documents: LinkedDocument[];
  count: number;
  hasDocument: boolean;
  loading: boolean;
  error: string | null;
  hasMissingDocuments: boolean;
}

/**
 * Hook pour récupérer les documents liés à un prêt
 * @param loanId ID du prêt
 * @param enabled Si false, ne charge pas les données (par défaut: true)
 */
export function useLoanDocuments(
  loanId: string | null | undefined,
  enabled: boolean = true
): UseLoanDocumentsResult {
  const { organizationId } = useCurrentOrganization();
  const [documents, setDocuments] = useState<LinkedDocument[]>([]);
  const [count, setCount] = useState(0);
  const [hasDocument, setHasDocument] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMissingDocuments, setHasMissingDocuments] = useState(false);

  useEffect(() => {
    if (!enabled || !loanId || !organizationId) {
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
          getLinkedDocumentsForLoan(loanId, organizationId),
          getDocumentCountForLoan(loanId, organizationId),
          hasDocumentForLoan(loanId, organizationId),
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
  }, [loanId, organizationId, enabled]);

  // Écouter les événements de refresh
  useEffect(() => {
    if (!enabled || !loanId || !organizationId) return;

    let cancelled = false;

    async function loadDocuments() {
      try {
        setLoading(true);
        setError(null);

        const [docs, docCount, hasDoc] = await Promise.all([
          getLinkedDocumentsForLoan(loanId, organizationId),
          getDocumentCountForLoan(loanId, organizationId),
          hasDocumentForLoan(loanId, organizationId),
        ]);

        if (!cancelled) {
          setDocuments(docs);
          setCount(docCount);
          setHasDocument(hasDoc);
          
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

    const handleRefresh = () => {
      loadDocuments();
    };

    window.addEventListener('documents:refresh', handleRefresh);
    window.addEventListener('loans:refresh', handleRefresh);

    return () => {
      cancelled = true;
      window.removeEventListener('documents:refresh', handleRefresh);
      window.removeEventListener('loans:refresh', handleRefresh);
    };
  }, [loanId, organizationId, enabled]);

  return {
    documents,
    count,
    hasDocument,
    loading,
    error,
    hasMissingDocuments,
  };
}

