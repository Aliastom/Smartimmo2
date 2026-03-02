/**
 * Hook pour gérer le statut de synchronisation
 * Expose le statut actuel, le nombre d'opérations en attente, etc.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getLocalDB } from '@/lib/offline/db';
import { getGlobalSyncService } from '@/lib/offline/syncGlobal';
import { setSyncStatus as setSyncStatusStore } from '@/lib/offline/syncStatusStore';
import { hasInitialFullSyncDone, initialFullSync } from '@/lib/offline/fullSync';
import type { SyncState } from '@/lib/offline/types';

export interface ExtendedSyncState extends SyncState {
  fullSyncDone: boolean;
  fullSyncRunning: boolean;
  errorOperationsCount: number;
}

export function useSyncStatus(organizationId?: string) {
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
      // ⚠️ CRITIQUE: Si getLocalDB retourne null (DB indisponible), retourner des valeurs par défaut
      if (!db) {
        setState(prev => ({
          ...prev,
          pendingOperationsCount: 0,
          errorOperationsCount: 0,
        }));
        return;
      }
      const [pendingCount, errorCount] = await Promise.all([
        db.pendingOperations.where('status').equals('pending').count(),
        db.pendingOperations.where('status').equals('error').count(),
      ]);
      
      setState(prev => ({
        ...prev,
        pendingOperationsCount: pendingCount,
        errorOperationsCount: errorCount,
      }));
    } catch (error: any) {
      // ⚠️ CRITIQUE: Ne pas throw, retourner des valeurs par défaut pour permettre à l'app de continuer
      console.error('[useSyncStatus] Erreur lors de la mise à jour du compteur:', error);
      setState(prev => ({
        ...prev,
        pendingOperationsCount: 0,
        errorOperationsCount: 0,
      }));
    }
  }, []);

  // Vérifier si la full sync a été effectuée
  const checkFullSyncStatus = useCallback(async () => {
    if (!organizationId) return;

    try {
      const done = await hasInitialFullSyncDone(organizationId);
      setState(prev => ({ ...prev, fullSyncDone: done }));
    } catch (error) {
      // Erreur silencieuse
    }
  }, [organizationId]);

  // Mettre à jour lastSyncAt
  const updateLastSyncAt = useCallback(async () => {
    try {
      const db = await getLocalDB();
      // ⚠️ CRITIQUE: Si getLocalDB retourne null (DB indisponible), retourner null
      if (!db) {
        setState(prev => ({
          ...prev,
          lastSyncAt: null,
        }));
        return;
      }
      const syncMeta = await db.syncMeta.get('properties');
      setState(prev => ({
        ...prev,
        lastSyncAt: syncMeta?.lastSyncAt || null,
      }));
    } catch (error: any) {
      // ⚠️ CRITIQUE: Ne pas throw, retourner null pour permettre à l'app de continuer
      console.error('[useSyncStatus] Erreur lors de la mise à jour de lastSyncAt:', error);
      setState(prev => ({
        ...prev,
        lastSyncAt: null,
      }));
    }
  }, []);

  // Précharger TOUTES les données de référence admin
  const preloadReferenceData = useCallback(async () => {
    if (!organizationId || typeof window === 'undefined') return;

    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
    const isAppShell = typeof window !== 'undefined' && window.location.pathname.startsWith('/app');
    
    // ⚠️ En mode app-shell, ne pas faire de préchargement API (les données sont déjà dans IndexedDB)
    if (isAppShell) {
      console.log('[useSyncStatus] Mode app-shell détecté, skip preloadReferenceData');
      return;
    }
    
    if (!isOnline) return; // Ne précharger qu'en ligne
    
    try {
      const { getLocalDB } = await import('@/lib/offline/db');
      const { TaxParamsService } = await import('@/services/TaxParamsService');
      const db = await getLocalDB();
      const taxService = new TaxParamsService();
      
      const now = new Date().toISOString();
      
      // 1. Types fiscaux
      try {
        const types = await taxService.getTypes(true);
        await Promise.all(
          types.map((type: any) =>
            db.FiscalType.put({
              ...type,
              cachedAt: now,
            })
          )
        );
        // Mettre à jour syncMeta pour cette table
        await db.syncMeta.put({
          table: 'fiscalTypes',
          lastSyncAt: now,
        });
        // Log supprimé
      } catch (error) {
        // Erreur silencieuse
      }
      
      // 2. Régimes fiscaux
      try {
        const regimes = await taxService.getRegimes(true);
        await Promise.all(
          regimes.map((regime: any) =>
            db.FiscalRegime.put({
              ...regime,
              cachedAt: now,
            })
          )
        );
        // Mettre à jour syncMeta pour cette table
        await db.syncMeta.put({
          table: 'fiscalRegimes',
          lastSyncAt: now,
        });
        // Log supprimé
      } catch (error) {
        // Erreur silencieuse
      }
      
      // 3. Compatibilités fiscales
      try {
        const compat = await taxService.getCompatibilities();
        await Promise.all(
          compat.map((c: any) =>
            db.fiscalCompatibilities.put({
              ...c,
              cachedAt: now,
            })
          )
        );
        // Mettre à jour syncMeta pour cette table
        await db.syncMeta.put({
          table: 'fiscalCompatibilities',
          lastSyncAt: now,
        });
        // Log supprimé
      } catch (error) {
        // Erreur silencieuse
      }
      
      // 4. Sociétés de gestion
      try {
        const res = await fetch('/api/gestion/societes');
        if (res.ok) {
          const data = await res.json();
          if (data.societes && Array.isArray(data.societes)) {
            await Promise.all(
              data.societes.map((societe: any) =>
                db.ManagementCompany.put({
                  ...societe,
                  cachedAt: now,
                })
              )
            );
            // Mettre à jour syncMeta pour cette table
            await db.syncMeta.put({
              table: 'managementCompanies',
              lastSyncAt: now,
            });
            // Log supprimé
          }
        }
      } catch (error) {
        // Erreur silencieuse
      }
      
      // 5. Natures de transaction
      try {
        const res = await fetch('/api/admin/natures');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data && Array.isArray(data.data)) {
            await Promise.all(
              data.data.map((nature: any) =>
                db.NatureEntity.put({
                  ...nature,
                  cachedAt: now,
                })
              )
            );
            // Mettre à jour syncMeta pour cette table
            await db.syncMeta.put({
              table: 'natures',
              lastSyncAt: now,
            });
            // Log supprimé
          }
        }
      } catch (error) {
        // Erreur silencieuse
      }
      
      // 6. Catégories comptables
      try {
        const res = await fetch('/api/accounting/categories');
        if (res.ok) {
          const categories = await res.json();
          if (Array.isArray(categories)) {
            await Promise.all(
              categories.map((cat: any) =>
                db.Category.put({
                  ...cat,
                  cachedAt: now,
                })
              )
            );
            // Mettre à jour syncMeta pour cette table
            await db.syncMeta.put({
              table: 'categories',
              lastSyncAt: now,
            });
            // Log supprimé
          }
        }
      } catch (error) {
        // Erreur silencieuse
      }
      
      // 7. Types de documents
      try {
        const res = await fetch('/api/document-types');
        if (res.ok) {
          const data = await res.json();
          // L'API retourne { documentTypes: [...], total: ... }
          const docTypes = Array.isArray(data) 
            ? data 
            : (data.documentTypes || data.data || data.types || []);
          if (Array.isArray(docTypes) && docTypes.length > 0) {
            await Promise.all(
              docTypes.map((docType: any) =>
                db.DocumentType.put({
                  id: docType.id || docType.code,
                  code: docType.code || docType.id,
                  label: docType.label || docType.name,
                  category: docType.category || docType.scope || null,
                  isActive: docType.isActive !== false,
                  cachedAt: now,
                })
              )
            );
            // Mettre à jour syncMeta pour cette table
            await db.syncMeta.put({
              table: 'documentTypes',
              lastSyncAt: now,
            });
            // Log supprimé
          } else {
            // Format inattendu (silencieux)
          }
        } else {
          // Erreur API (silencieuse)
        }
      } catch (error) {
        // Erreur silencieuse
      }
      
      // 8. Signaux (catalogue global)
      try {
        const res = await fetch('/api/admin/signals');
        if (res.ok) {
          const data = await res.json();
          const signals = Array.isArray(data) ? data : (data.data || data.signals || []);
          if (Array.isArray(signals)) {
            await Promise.all(
              signals.map((signal: any) =>
                db.Signal.put({
                  id: signal.id || signal.code,
                  code: signal.code || signal.id,
                  label: signal.label || signal.name,
                  category: signal.category || null,
                  isActive: signal.isActive !== false,
                  cachedAt: now,
                })
              )
            );
            // Mettre à jour syncMeta pour cette table
            await db.syncMeta.put({
              table: 'signals',
              lastSyncAt: now,
            });
            // Log supprimé
          }
        }
      } catch (error) {
        // Erreur silencieuse
      }
      
      // Log supprimé
    } catch (error) {
      // Erreur silencieuse
    }
  }, [organizationId]);

  // Démarrer une synchronisation complète (toutes les entités)
  const sync = useCallback(async () => {
    if (!organizationId) {
      // Log supprimé
      return;
    }

    setState(prev => ({ ...prev, status: 'syncing', error: undefined }));
    setSyncStatusStore('syncing', organizationId);

    try {
      const globalSyncService = getGlobalSyncService();
      
      // ⚠️ CRITIQUE: Ordre strict selon le modèle de synchronisation
      // 1. D'abord pousser les pendingOps vers Supabase (écritures locales → SB)
      // 2. Ensuite faire l'overwrite SB → IDB (Supabase = source de vérité absolue)
      // Cela garantit que les modifications locales sont d'abord synchronisées avant d'être potentiellement écrasées
      const toRemoteResults = await globalSyncService.syncAllPendingToRemote(organizationId);
      
      // 2. Overwrite total depuis Supabase vers IndexedDB
      const fromRemoteResults = await globalSyncService.syncAllFromRemote(organizationId);

      // Précharger les données de référence en parallèle (non bloquant)
      preloadReferenceData().catch(() => {}); // Erreur silencieuse

      // Calculer les totaux
      const totalSynced = Object.values(fromRemoteResults).reduce((sum, r) => sum + r.synced, 0) +
                          Object.values(toRemoteResults).reduce((sum, r) => sum + r.synced, 0);
      const totalErrors = Object.values(fromRemoteResults).reduce((sum, r) => sum + r.errors, 0) +
                          Object.values(toRemoteResults).reduce((sum, r) => sum + r.errors, 0);
      const hasErrors = totalErrors > 0;

      // Trouver la première erreur pour l'afficher
      const firstError = Object.values(fromRemoteResults).find(r => r.error)?.error ||
                         Object.values(toRemoteResults).find(r => r.error)?.error;

      const newStatus = hasErrors ? 'error' : 'idle';
      setState(prev => ({
        ...prev,
        status: newStatus,
        error: hasErrors 
          ? firstError || `${totalErrors} erreurs`
          : undefined,
      }));
      setSyncStatusStore(newStatus, organizationId);

      // Mettre à jour les compteurs
      await updatePendingCount();
      await updateLastSyncAt();
      
      // ⚠️ CRITIQUE: Émettre l'événement sync:refresh pour que les pages se rafraîchissent
      // (conforme au modèle : "Émet un event sync:refresh pour permettre aux pages de se rafraîchir si besoin")
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sync:refresh', { 
          detail: { 
            organizationId,
            fromRemoteResults,
            toRemoteResults,
          } 
        }));
      }
      
      // Retourner les résultats détaillés pour les logs
      return {
        fromRemoteResults,
        toRemoteResults,
        totalSynced,
        totalErrors,
      };
    } catch (error: any) {
      // ⚠️ CRITIQUE: Si DB_UNAVAILABLE, remettre le statut à 'idle' (pas 'error') pour éviter le loader infini
      const isDbUnavailable = error?.message?.includes('DB_UNAVAILABLE') || 
                              error?.name === 'DbUnavailableError';
      
      const newStatus = isDbUnavailable ? 'idle' : 'error';
      const errorMessage = isDbUnavailable 
        ? undefined // Pas d'erreur affichée si DB indisponible (l'écran de recovery s'affiche déjà)
        : (error.message || 'Erreur lors de la synchronisation');
      
      setState(prev => ({
        ...prev,
        status: newStatus,
        error: errorMessage,
      }));
      setSyncStatusStore(newStatus, organizationId);

      // Si DB_UNAVAILABLE, ne pas throw pour éviter que AppShellClient affiche une erreur
      // (l'écran de recovery est déjà affiché)
      if (!isDbUnavailable) {
        throw error; // Re-lancer pour que AppShellClient puisse logger l'erreur
      }
    }
  }, [organizationId, updatePendingCount, updateLastSyncAt, preloadReferenceData]);

  // Lancer la full sync initiale si nécessaire
  const triggerFullSyncIfNeeded = useCallback(async () => {
    if (!organizationId || !state.isOnline || state.fullSyncRunning || state.fullSyncDone) {
      return;
    }

    try {
      setState(prev => ({ ...prev, fullSyncRunning: true }));
      setSyncStatusStore('syncing', organizationId);

      const result = await initialFullSync(organizationId);

      setState(prev => ({
        ...prev,
        fullSyncDone: result.success,
        fullSyncRunning: false,
      }));
      setSyncStatusStore('idle', organizationId);

      // Après la full sync, lancer une sync normale (push puis overwrite, ordre strict)
      if (result.success) {
        const globalSyncService = getGlobalSyncService();
        await globalSyncService.syncAllPendingToRemote(organizationId);
        await globalSyncService.syncAllFromRemote(organizationId);
        await updatePendingCount();
      }
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        fullSyncRunning: false,
        error: error.message || 'Erreur lors de la synchronisation complète',
      }));
      setSyncStatusStore('idle', organizationId);
    }
  }, [organizationId, state.isOnline, state.fullSyncRunning, state.fullSyncDone, updatePendingCount]);

  // Vérifier le statut de la full sync au démarrage
  useEffect(() => {
    if (organizationId) {
      checkFullSyncStatus();
    }
  }, [organizationId, checkFullSyncStatus]);

  // Full sync automatique si la base est vide et qu'on est en ligne (Situation 1 du superprompt)
  useEffect(() => {
    if (!organizationId || !state.isOnline || state.fullSyncRunning) {
      return;
    }

    // Vérifier si la base est vide (aucune full sync jamais effectuée)
    const checkAndTriggerFullSync = async () => {
      try {
        const done = await hasInitialFullSyncDone(organizationId);
        
        // Si pas de full sync, lancer automatiquement (base vide)
        if (!done) {
          console.log('[useSyncStatus] Base vide détectée, déclenchement automatique de la full sync initiale');
          setState(prev => ({ ...prev, fullSyncRunning: true }));
          setSyncStatusStore('syncing', organizationId);
          
          try {
            const result = await initialFullSync(organizationId);
            setState(prev => ({
              ...prev,
              fullSyncDone: result.success,
              fullSyncRunning: false,
            }));
            setSyncStatusStore('idle', organizationId);

            // Après la full sync, lancer une sync normale (push puis overwrite, ordre strict)
            if (result.success) {
              const globalSyncService = getGlobalSyncService();
              await globalSyncService.syncAllPendingToRemote(organizationId);
              await globalSyncService.syncAllFromRemote(organizationId);
              await updatePendingCount();
            }
          } catch (error: any) {
            setState(prev => ({
              ...prev,
              fullSyncRunning: false,
              error: error.message || 'Erreur lors de la synchronisation complète',
            }));
            setSyncStatusStore('idle', organizationId);
          }
        }
      } catch (error) {
        // Erreur silencieuse
      }
    };

    // Attendre un court délai pour laisser le temps à la base de s'initialiser et à la migration de se faire
    const timer = setTimeout(() => {
      checkAndTriggerFullSync();
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [organizationId, state.isOnline, state.fullSyncRunning, updatePendingCount]);

  // Écouter les changements d'état réseau
  useEffect(() => {
    const handleOnline = () => {
      setState(prev => ({ ...prev, isOnline: true, status: 'idle' }));
      setSyncStatusStore('idle');
      
      // DÉSACTIVÉ : Auto-sync quand on revient en ligne
      // La synchronisation se fait uniquement sur clic du bouton
      // if (organizationId) {
      //   sync();
      // }
    };

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOnline: false, status: 'offline' }));
      setSyncStatusStore('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [organizationId]);

  // Surveiller les opérations en attente
  // ⚠️ CRITIQUE: Ajouter un mécanisme de retry avec backoff pour éviter les boucles infinies
  const retryCountRef = useRef(0);
  const maxRetries = 3;
  const hasStoppedRef = useRef(false);
  
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let cancelled = false;
    
    const updateWithRetry = async () => {
      // Si on a déjà arrêté les tentatives, ne rien faire
      if (hasStoppedRef.current) {
        return;
      }
      
      try {
        await updatePendingCount();
        await updateLastSyncAt();
        // Si succès, réinitialiser le compteur de retry
        if (retryCountRef.current > 0) {
          retryCountRef.current = 0;
        }
      } catch (error: any) {
        // Si erreur, incrémenter le compteur de retry
        retryCountRef.current += 1;
        
        // Si trop de retries, arrêter les tentatives
        if (retryCountRef.current >= maxRetries) {
          console.error(`[useSyncStatus] ❌ Arrêt des tentatives après ${maxRetries} erreurs consécutives`);
          hasStoppedRef.current = true;
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          setState(prev => ({
            ...prev,
            error: 'La base de données locale n\'est pas accessible. Veuillez recharger la page.',
          }));
        }
      }
    };
    
    // Première tentative immédiate
    updateWithRetry();
    
    // Surveiller les changements dans la DB locale avec backoff exponentiel
    // Si des erreurs se produisent, augmenter l'intervalle progressivement
    const baseInterval = 5000;
    const getCurrentInterval = () => {
      const retryCount = retryCountRef.current;
      return baseInterval * Math.pow(2, Math.min(retryCount, 3));
    };
    
    const scheduleNextUpdate = () => {
      if (cancelled || hasStoppedRef.current) {
        return;
      }
      
      const currentInterval = getCurrentInterval();
      intervalId = setTimeout(() => {
        if (!cancelled && !hasStoppedRef.current) {
          updateWithRetry().finally(() => {
            scheduleNextUpdate();
          });
        }
      }, currentInterval);
    };
    
    // Démarrer le cycle de mise à jour
    scheduleNextUpdate();

    return () => {
      cancelled = true;
      if (intervalId) {
        clearTimeout(intervalId);
      }
    };
  }, [updatePendingCount, updateLastSyncAt]);

  // DÉSACTIVÉ : Auto-sync au montage
  // La synchronisation se fait uniquement sur clic du bouton
  // useEffect(() => {
  //   if (organizationId && state.isOnline && state.status === 'idle') {
  //     const timer = setTimeout(() => {
  //       sync();
  //     }, 1000);
  //     return () => clearTimeout(timer);
  //   }
  // }, [organizationId]);

  return {
    ...state,
    sync,
    refresh: async () => {
      await updatePendingCount();
      await updateLastSyncAt();
    },
  };
}





