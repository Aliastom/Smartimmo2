'use client';

import { useState, useEffect, useCallback } from 'react';

interface UploadSessionDocument {
  id: string;
  name: string;
  status: 'draft' | 'active';
  type: string;
  typeId: string | null;
  size: number;
  mime: string;
  intendedContext: {
    type: string | null;
    tempKey: string | null;
  };
  uploadedAt: string;
}

interface UploadSession {
  id: string;
  createdAt: string;
  expiresAt: string;
}

interface UseUploadSessionPollingResult {
  session: UploadSession | null;
  documents: UploadSessionDocument[];
  isLoading: boolean;
  error: string | null;
  refreshSession: () => Promise<void>;
  startPolling: (sessionId: string, interval?: number) => void;
  stopPolling: () => void;
}

export function useUploadSessionPolling(): UseUploadSessionPollingResult {
  const [session, setSession] = useState<UploadSession | null>(null);
  const [documents, setDocuments] = useState<UploadSessionDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  const refreshSession = useCallback(async (sessionId?: string) => {
    if (!sessionId && !session?.id) return;
    
    const id = sessionId || session!.id;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/uploads/session/${id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la récupération de la session');
      }

      setSession(data.session);
      setDocuments(data.documents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      console.error('Erreur lors du refresh de la session:', err);
    } finally {
      setIsLoading(false);
    }
  }, [session?.id]);

  const startPolling = useCallback((sessionId: string, interval: number = 2000) => {
    // Arrêter le polling existant
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    // Démarrer le nouveau polling
    const newInterval = setInterval(() => {
      refreshSession(sessionId);
    }, interval);

    setPollingInterval(newInterval);
    
    // Premier refresh immédiat
    refreshSession(sessionId);
  }, [pollingInterval, refreshSession]);

  const stopPolling = useCallback(() => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  }, [pollingInterval]);

  // Nettoyer le polling au démontage
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  return {
    session,
    documents,
    isLoading,
    error,
    refreshSession,
    startPolling,
    stopPolling
  };
}
