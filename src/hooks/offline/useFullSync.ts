/**
 * Hook pour gérer la synchronisation complète initiale (Full Sync)
 */

import { useState, useEffect, useCallback } from 'react';
import { getLocalDB } from '@/lib/offline/db';
import { initialFullSync, hasInitialFullSyncDone, resetFullSync } from '@/lib/offline/fullSync';
import type { FullSyncResult } from '@/lib/offline/fullSync';

export interface FullSyncState {
  isRunning: boolean;
  isDone: boolean;
  progress: Record<string, { synced: number; errors: number }>;
  error?: string;
}

export function useFullSync(organizationId?: string) {
  const [state, setState] = useState<FullSyncState>({
    isRunning: false,
    isDone: false,
    progress: {},
    error: undefined,
  });

  /**
   * Vérifie si la full sync a déjà été effectuée
   */
  const checkFullSyncStatus = useCallback(async () => {
    if (!organizationId) return;

    try {
      const done = await hasInitialFullSyncDone(organizationId);
      setState(prev => ({ ...prev, isDone: done }));
    } catch (error) {
      // Erreur silencieuse
    }
  }, [organizationId]);

  /**
   * Lance la full sync
   */
  const runFullSync = useCallback(async (): Promise<FullSyncResult> => {
    if (!organizationId) {
      throw new Error('organizationId requis pour la full sync');
    }

    setState({
      isRunning: true,
      isDone: false,
      progress: {},
      error: undefined,
    });

    try {
      const result = await initialFullSync(organizationId);

      setState({
        isRunning: false,
        isDone: result.success,
        progress: result.tables,
        error: result.error,
      });

      // Déclencher un événement de refresh pour que les hooks rechargent les données
      if (result.success && typeof window !== 'undefined') {
        // Log supprimé
        // Déclencher plusieurs événements pour couvrir tous les hooks qui en ont besoin
        window.dispatchEvent(new CustomEvent('dashboard:refresh'));
        window.dispatchEvent(new CustomEvent('insights:refresh'));
        window.dispatchEvent(new CustomEvent('filters:changed'));
        // Événement générique pour tous les hooks
        window.dispatchEvent(new CustomEvent('fullSync:complete', { detail: { organizationId } }));
      }

      return result;
    } catch (error: any) {
      const errorMessage = error.message || 'Erreur lors de la synchronisation complète';
      setState({
        isRunning: false,
        isDone: false,
        progress: {},
        error: errorMessage,
      });
      throw error;
    }
  }, [organizationId]);

  /**
   * Réinitialise la full sync (force une nouvelle sync)
   */
  const reset = useCallback(async () => {
    if (!organizationId) return;

    await resetFullSync(organizationId);
    setState({
      isRunning: false,
      isDone: false,
      progress: {},
      error: undefined,
    });
  }, [organizationId]);

  // Vérifier le statut au montage
  useEffect(() => {
    checkFullSyncStatus();
  }, [checkFullSyncStatus]);

  return {
    ...state,
    runFullSync,
    reset,
    checkStatus: checkFullSyncStatus,
  };
}




