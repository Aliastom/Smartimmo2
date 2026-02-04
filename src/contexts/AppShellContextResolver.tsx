/**
 * AppShellContextResolver - Résolution centralisée du contexte AppShell
 * 
 * Ce hook/provider résout de manière déterministe le currentOrganizationId pour l'app-shell.
 * Sources autorisées (par ordre de priorité) :
 * 1. Session/auth (via useAppSession)
 * 2. app_state.currentOrganizationId (IndexedDB)
 * 
 * Interdit : utiliser "la première propriété" comme orgId (risque multi-org).
 */

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getLocalDB, type AppState } from '@/lib/offline/db';
import { useAppSession } from '@/features/auth/useAppSession';
import { useAppAuth } from '@/features/auth/useAppAuth';

export type AppShellContextStatus = 'resolving' | 'ready' | 'error';

export interface AppShellContext {
  organizationId: string | undefined;
  userId: string | undefined;
  status: AppShellContextStatus;
  error: string | null;
  updateOrganizationId: (orgId: string | undefined) => Promise<void>;
}

const AppShellContextResolverContext = createContext<AppShellContext | null>(null);

export function useAppShellContext(): AppShellContext {
  const context = useContext(AppShellContextResolverContext);
  if (!context) {
    throw new Error('useAppShellContext must be used within AppShellContextResolverProvider');
  }
  return context;
}

/**
 * Hook optionnel pour utiliser AppShellContext si disponible, sinon retourne null
 * Utile pour les hooks qui fonctionnent en mode normal et app-shell
 */
export function useAppShellContextOptional(): AppShellContext | null {
  try {
    return useContext(AppShellContextResolverContext);
  } catch {
    return null;
  }
}

interface AppShellContextResolverProviderProps {
  children: React.ReactNode;
}

const APP_STATE_ID = 'current';

export function AppShellContextResolverProvider({ children }: AppShellContextResolverProviderProps) {
  const { authReady } = useAppAuth();
  const { session, organizationId: sessionOrgId, isLoading: sessionLoading } = useAppSession();
  
  const [organizationId, setOrganizationId] = useState<string | undefined>(undefined);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<AppShellContextStatus>('resolving');
  const [error, setError] = useState<string | null>(null);

  // Charger l'état depuis IndexedDB
  const loadAppState = useCallback(async (): Promise<AppState | null> => {
    try {
      const db = await getLocalDB();
      // ⚠️ CRITIQUE: Si getLocalDB retourne null (DB indisponible), ne pas throw
      if (!db) {
        console.warn('[AppShellContextResolver] DB indisponible, app_state non chargé');
        return null;
      }
      const appState = await db.AppState.get(APP_STATE_ID);
      return appState || null;
    } catch (e) {
      console.warn('[AppShellContextResolver] Erreur chargement app_state:', e);
      return null;
    }
  }, []);

  // Sauvegarder l'état dans IndexedDB
  const saveAppState = useCallback(async (orgId: string | undefined, usrId: string | undefined) => {
    try {
      const db = await getLocalDB();
      // ⚠️ CRITIQUE: Si getLocalDB retourne null (DB indisponible), ne pas throw
      if (!db) {
        console.warn('[AppShellContextResolver] DB indisponible, app_state non sauvegardé');
        return; // Ne pas throw, permettre à l'app de continuer
      }
      const now = new Date().toISOString();
      await db.AppState.put({
        id: APP_STATE_ID,
        currentOrganizationId: orgId || null,
        userId: usrId || null,
        sessionId: session?.user?.id || null,
        updatedAt: now,
      });
    } catch (e) {
      console.error('[AppShellContextResolver] Erreur sauvegarde app_state:', e);
      // Ne pas throw, permettre à l'app de continuer même si la sauvegarde échoue
    }
  }, [session]);

  // Fonction publique pour mettre à jour organizationId
  const updateOrganizationId = useCallback(async (orgId: string | undefined) => {
    try {
      setStatus('resolving');
      setError(null);
      
      await saveAppState(orgId, userId);
      setOrganizationId(orgId);
      setStatus('ready');
    } catch (e: any) {
      const errorMsg = e?.message || 'Erreur lors de la mise à jour de organizationId';
      console.error('[AppShellContextResolver] Erreur updateOrganizationId:', e);
      setError(errorMsg);
      setStatus('error');
    }
  }, [userId, saveAppState]);

  // Résoudre le contexte
  useEffect(() => {
    if (!authReady) {
      return; // Attendre que l'auth soit prête
    }

    let cancelled = false;

    const resolveContext = async () => {
      try {
        setStatus('resolving');
        setError(null);

        // Priorité 1: Session/auth (si disponible)
        if (sessionOrgId) {
          if (!cancelled) {
            setOrganizationId(sessionOrgId);
            setUserId(session?.user?.id);
            setStatus('ready');
            // Sauvegarder dans app_state pour usage offline futur
            await saveAppState(sessionOrgId, session?.user?.id);
          }
          return;
        }

        // Si session est en cours de chargement, attendre
        if (sessionLoading) {
          return;
        }

        // Priorité 2: app_state depuis IndexedDB (offline ou session non disponible)
        const appState = await loadAppState();
        if (appState?.currentOrganizationId) {
          if (!cancelled) {
            setOrganizationId(appState.currentOrganizationId);
            setUserId(appState.userId || undefined);
            setStatus('ready');
            console.log('[AppShellContextResolver] ✅ Contexte résolu depuis app_state:', appState.currentOrganizationId);
          }
          return;
        }

        // Fallback temporaire : localStorage (pour transition)
        // ⚠️ Ceci est un fallback temporaire pour la migration, à supprimer une fois que tous les utilisateurs ont app_state
        const storedOrgId = typeof window !== 'undefined' 
          ? (localStorage.getItem('organizationId') || localStorage.getItem('currentOrganizationId'))
          : null;
        
        if (storedOrgId) {
          console.log('[AppShellContextResolver] ⚠️ Fallback localStorage utilisé (migration temporaire):', storedOrgId);
          // Sauvegarder dans app_state pour usage futur
          try {
            await saveAppState(storedOrgId, undefined);
          } catch (e) {
            console.warn('[AppShellContextResolver] Erreur sauvegarde app_state depuis localStorage:', e);
          }
          if (!cancelled) {
            setOrganizationId(storedOrgId);
            setStatus('ready');
          }
          return;
        }

        // Pas d'organizationId trouvé
        if (!cancelled) {
          console.warn('[AppShellContextResolver] ❌ Aucune organisation trouvée (session, app_state, localStorage)');
          setOrganizationId(undefined);
          setUserId(undefined);
          setStatus('error');
          setError('Aucune organisation disponible. Veuillez vous connecter.');
        }
      } catch (e: any) {
        if (!cancelled) {
          const errorMsg = e?.message || 'Erreur lors de la résolution du contexte';
          console.error('[AppShellContextResolver] Erreur résolution:', e);
          setError(errorMsg);
          setStatus('error');
          setOrganizationId(undefined);
          setUserId(undefined);
        }
      }
    };

    resolveContext();

    return () => {
      cancelled = true;
    };
  }, [authReady, sessionOrgId, session, sessionLoading, loadAppState, saveAppState]);

  const contextValue: AppShellContext = {
    organizationId,
    userId,
    status,
    error,
    updateOrganizationId,
  };

  return (
    <AppShellContextResolverContext.Provider value={contextValue}>
      {children}
    </AppShellContextResolverContext.Provider>
  );
}

