/**
 * Contexte global pour l'état de la base de données locale IndexedDB
 * Gère les états : OK | RECOVERED | UNAVAILABLE
 * 
 * ⚠️ CRITIQUE: Ce contexte permet à l'application de continuer à fonctionner
 * même si IndexedDB est indisponible, évitant ainsi les blocages UI.
 */

'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type LocalDbStatus = 'OK' | 'RECOVERED' | 'UNAVAILABLE';

interface LocalDbStatusContextValue {
  status: LocalDbStatus;
  error: Error | null;
  setStatus: (status: LocalDbStatus, error?: Error | null) => void;
  resetDb: () => Promise<void>;
  retryOpen: () => Promise<void>;
  isResetting: boolean;
  isRetrying: boolean;
}

const LocalDbStatusContext = createContext<LocalDbStatusContextValue | undefined>(undefined);

export function LocalDbStatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatusState] = useState<LocalDbStatus>('OK');
  const [error, setError] = useState<Error | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  
  // Écouter les événements de DB au démarrage
  useEffect(() => {
    const handleDbUnavailable = (event: CustomEvent) => {
      setStatusState('UNAVAILABLE');
      setError(event.detail?.error || null);
    };
    
    const handleDbRecovered = () => {
      setStatusState('RECOVERED');
      setError(null);
    };
    
    const handleDbOk = () => {
      setStatusState('OK');
      setError(null);
    };
    
    window.addEventListener('localdb:unavailable', handleDbUnavailable as EventListener);
    window.addEventListener('localdb:recovered', handleDbRecovered);
    window.addEventListener('localdb:ok', handleDbOk);
    
    return () => {
      window.removeEventListener('localdb:unavailable', handleDbUnavailable as EventListener);
      window.removeEventListener('localdb:recovered', handleDbRecovered);
      window.removeEventListener('localdb:ok', handleDbOk);
    };
  }, []);

  const setStatus = useCallback((newStatus: LocalDbStatus, newError?: Error | null) => {
    setStatusState(newStatus);
    setError(newError || null);
    
    // Logs pour traçabilité
    if (newStatus === 'UNAVAILABLE') {
      console.error('[LocalDbStatus] ❌ DB_UNAVAILABLE:', newError?.message || 'Unknown error');
    } else if (newStatus === 'RECOVERED') {
      console.log('[LocalDbStatus] ✅ DB_RECOVERED après retry');
    } else {
      console.log('[LocalDbStatus] ✅ DB_OK');
    }
  }, []);

  const resetDb = useCallback(async () => {
    if (isResetting) return;
    
    setIsResetting(true);
    try {
      console.log('[LocalDbStatus] 🔄 Réinitialisation de la base de données locale...');
      
      // Importer dynamiquement Dexie pour éviter les problèmes d'ordre d'import
      const DexieModule = await import('dexie');
      const Dexie = DexieModule.default;
      
      // Supprimer la base de données
      await Dexie.delete('SmartimmoLocalDB');
      
      console.log('[LocalDbStatus] ✅ Base de données supprimée, rechargement de la page...');
      
      // Réinitialiser l'état
      setStatus('OK', null);
      
      // Recharger la page après un court délai pour permettre à l'utilisateur de voir le message
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error: any) {
      console.error('[LocalDbStatus] ❌ Erreur lors de la réinitialisation:', error);
      setStatus('UNAVAILABLE', error);
    } finally {
      setIsResetting(false);
    }
  }, [isResetting, setStatus]);

  const retryOpen = useCallback(async () => {
    if (isRetrying || isResetting) return;
    
    setIsRetrying(true);
    try {
      console.log('[LocalDbStatus] 🔄 Tentative de réouverture de la base de données...');
      
      // Réinitialiser le statut global pour permettre un nouveau retry
      const { resetDbStatus } = await import('@/lib/offline/db');
      resetDbStatus();
      
      // Réinitialiser le statut local
      setStatus('OK', null);
      
      // Importer getLocalDB et forcer un retry
      const { getLocalDB } = await import('@/lib/offline/db');
      
      // Attendre un court délai pour permettre à IndexedDB de se libérer
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Tenter de rouvrir la base
      const db = await getLocalDB();
      
      if (db && db.isOpen()) {
        console.log('[LocalDbStatus] ✅ Base de données rouverte avec succès');
        setStatus('RECOVERED', null);
      } else {
        console.error('[LocalDbStatus] ❌ Impossible de rouvrir la base de données');
        setStatus('UNAVAILABLE', new Error('Impossible de rouvrir la base de données'));
      }
    } catch (error: any) {
      console.error('[LocalDbStatus] ❌ Erreur lors de la tentative de réouverture:', error);
      setStatus('UNAVAILABLE', error);
    } finally {
      setIsRetrying(false);
    }
  }, [isRetrying, isResetting, setStatus]);

  return (
    <LocalDbStatusContext.Provider
      value={{
        status,
        error,
        setStatus,
        resetDb,
        retryOpen,
        isResetting,
        isRetrying,
      }}
    >
      {children}
    </LocalDbStatusContext.Provider>
  );
}

export function useLocalDbStatus() {
  const context = useContext(LocalDbStatusContext);
  if (context === undefined) {
    throw new Error('useLocalDbStatus must be used within a LocalDbStatusProvider');
  }
  return context;
}

