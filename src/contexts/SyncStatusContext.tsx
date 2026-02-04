'use client';

/**
 * Context pour partager l'état de synchronisation entre tous les composants
 * Résout le problème où chaque instance de useSyncStatus avait son propre état local
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getLocalDB } from '@/lib/offline/db';
import { getGlobalSyncService } from '@/lib/offline/syncGlobal';
import { hasInitialFullSyncDone, initialFullSync } from '@/lib/offline/fullSync';
import type { SyncState } from '@/lib/offline/types';

export interface ExtendedSyncState extends SyncState {
  fullSyncDone: boolean;
  fullSyncRunning: boolean;
  errorOperationsCount: number;
}

interface SyncStatusContextValue {
  state: ExtendedSyncState;
  sync: () => Promise<any>;
  refresh: () => Promise<void>;
}

const SyncStatusContext = createContext<SyncStatusContextValue | undefined>(undefined);

export function SyncStatusProvider({ 
  children, 
  organizationId 
}: { 
  children: React.ReactNode; 
  organizationId?: string;
}) {
  const [state, setState] = useState<ExtendedSyncState>({
    status: 'idle',
    pendingOperationsCount: 0,
    lastSyncAt: null,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    error: undefined,
    fullSyncDone: false,
    fullSyncRunning: false,
    errorOperationsCount: 0,
  });

  // Mettre à jour le compteur d'opérations en attente et en erreur
  const updatePendingCount = useCallback(async () => {
    try {
      const db = await getLocalDB();
      const [pendingCount, errorCount] = await Promise.all([
        db.pendingOperations.where('status').equals('pending').count(),
        db.pendingOperations.where('status').equals('error').count(),
      ]);
      
      setState(prev => ({
        ...prev,
        pendingOperationsCount: pendingCount,
        errorOperationsCount: errorCount,
      }));
    } catch (error) {
      // Erreur silencieuse
    }
  }, []);

  // Mettre à jour lastSyncAt
  const updateLastSyncAt = useCallback(async () => {
    try {
      const db = await getLocalDB();
      const syncMeta = await db.syncMeta.get('properties');
      setState(prev => ({
        ...prev,
        lastSyncAt: syncMeta?.lastSyncAt || null,
      }));
    } catch (error) {
      // Erreur silencieuse
    }
  }, []);

  // Démarrer une synchronisation complète
  const sync = useCallback(async () => {
    if (!organizationId) {
      return;
    }

    setState(prev => ({ ...prev, status: 'syncing', error: undefined }));

    try {
      const globalSyncService = getGlobalSyncService();
      
      // ⚠️ CRITIQUE: Ordre strict selon le modèle de synchronisation
      const toRemoteResults = await globalSyncService.syncAllPendingToRemote(organizationId);
      const fromRemoteResults = await globalSyncService.syncAllFromRemote(organizationId);

      // Calculer les totaux
      const totalSynced = Object.values(fromRemoteResults).reduce((sum, r) => sum + r.synced, 0) +
                          Object.values(toRemoteResults).reduce((sum, r) => sum + r.synced, 0);
      const totalErrors = Object.values(fromRemoteResults).reduce((sum, r) => sum + r.errors, 0) +
                          Object.values(toRemoteResults).reduce((sum, r) => sum + r.errors, 0);
      const hasErrors = totalErrors > 0;

      const firstError = Object.values(fromRemoteResults).find(r => r.error)?.error ||
                         Object.values(toRemoteResults).find(r => r.error)?.error;

      setState(prev => ({
        ...prev,
        status: hasErrors ? 'error' : 'idle',
        error: hasErrors 
          ? firstError || `${totalErrors} erreurs`
          : undefined,
      }));

      await updatePendingCount();
      await updateLastSyncAt();
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sync:refresh', { 
          detail: { 
            organizationId,
            fromRemoteResults,
            toRemoteResults,
          } 
        }));
      }
      
      return {
        fromRemoteResults,
        toRemoteResults,
        totalSynced,
        totalErrors,
      };
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error.message || 'Erreur lors de la synchronisation',
      }));
      throw error;
    }
  }, [organizationId, updatePendingCount, updateLastSyncAt]);

  // Rafraîchir les compteurs
  const refresh = useCallback(async () => {
    await updatePendingCount();
    await updateLastSyncAt();
  }, [updatePendingCount, updateLastSyncAt]);

  // Écouter les changements d'état réseau
  useEffect(() => {
    const handleOnline = () => {
      setState(prev => ({ ...prev, isOnline: true, status: 'idle' }));
    };

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOnline: false, status: 'offline' }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Surveiller les opérations en attente
  useEffect(() => {
    updatePendingCount();
    updateLastSyncAt();

    const interval = setInterval(() => {
      updatePendingCount();
      updateLastSyncAt();
    }, 5000);

    return () => clearInterval(interval);
  }, [updatePendingCount, updateLastSyncAt]);

  // Vérifier si la full sync a été effectuée
  useEffect(() => {
    if (!organizationId) return;

    const checkFullSyncStatus = async () => {
      try {
        const done = await hasInitialFullSyncDone(organizationId);
        setState(prev => ({ ...prev, fullSyncDone: done }));
      } catch (error) {
        // Erreur silencieuse
      }
    };

    checkFullSyncStatus();
  }, [organizationId]);

  return (
    <SyncStatusContext.Provider value={{ state, sync, refresh }}>
      {children}
    </SyncStatusContext.Provider>
  );
}

export function useSyncStatusContext() {
  const context = useContext(SyncStatusContext);
  if (context === undefined) {
    throw new Error('useSyncStatusContext must be used within a SyncStatusProvider');
  }
  return context;
}













