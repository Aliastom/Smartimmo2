'use client';

/**
 * Guard d'authentification pour le mode App Shell
 * Protège toutes les pages et redirige vers /app/login si non authentifié
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAppAuth } from '@/features/auth/useAppAuth';
import { logToServer } from '@/lib/utils/logger';
import { InitialOnlineRequiredScreen } from '@/components/offline/InitialOnlineRequiredScreen';
import { PinSetupScreen } from '@/components/offline/PinSetupScreen';
import { PinLockScreen } from '@/components/offline/PinLockScreen';
import {
  dismissTrustPrompt,
  isPinUnlocked,
  isTrustedDeviceEnabled,
  isTrustPromptDismissed,
} from '@/lib/security/pin';
import { getLocalDB } from '@/lib/offline/db';
import { hasInitialFullSyncDone } from '@/lib/offline/fullSync';

type AppShellAuthGuardProps = {
  children: React.ReactNode;
};

export function AppShellAuthGuard({ children }: AppShellAuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, authReady, isOffline, organizationId } = useAppAuth();
  const [trustReady, setTrustReady] = useState(false);
  const [trustEnabled, setTrustEnabled] = useState(false);
  const [pinUnlocked, setPinUnlockedState] = useState(false);
  const [shouldPromptTrust, setShouldPromptTrust] = useState(false);
  const [dbReady, setDbReady] = useState<'unknown' | 'ready' | 'empty' | 'unavailable'>('unknown');
  const authStatus: 'loading' | 'authenticated' | 'unauthenticated' =
    !authReady || loading ? 'loading' : user ? 'authenticated' : 'unauthenticated';

  const refreshTrustState = useCallback(() => {
    if (typeof window === 'undefined') return;
    const enabled = isTrustedDeviceEnabled();
    const unlocked = isPinUnlocked();
    const dismissed = isTrustPromptDismissed();
    setTrustEnabled(enabled);
    setPinUnlockedState(unlocked);
    setShouldPromptTrust(!enabled && !dismissed);
    setTrustReady(true);
  }, []);

  useEffect(() => {
    refreshTrustState();
  }, [refreshTrustState]);

  // Vérifier si la DB locale est disponible et initialisée
  useEffect(() => {
    let cancelled = false;

    const checkDbReady = async () => {
      if (!isOffline) {
        setDbReady('ready');
        return;
      }

      try {
        const db = await getLocalDB();
        if (!db) {
          if (!cancelled) setDbReady('unavailable');
          return;
        }

        if (!organizationId) {
          if (!cancelled) setDbReady('empty');
          return;
        }

        const hasFullSync = await hasInitialFullSyncDone(organizationId);
        if (!cancelled) {
          setDbReady(hasFullSync ? 'ready' : 'empty');
        }
      } catch {
        if (!cancelled) setDbReady('unavailable');
      }
    };

    checkDbReady();

    return () => {
      cancelled = true;
    };
  }, [isOffline, organizationId]);

  // PHASE 2 — Auth local (offline ou online)
  // Utiliser un ref pour éviter les logs StrictMode
  const phase2LoggedRef = React.useRef(false);
  useEffect(() => {
    // Ne pas rediriger si on est déjà sur la page de login
    if (typeof window !== 'undefined' && window.location.pathname === '/app/login') {
      return;
    }

    // Attendre que l'auth soit prête
    if (authStatus === 'loading') {
      return;
    }

    // Logger une seule fois (PHASE 2 optimisée)
    if (!phase2LoggedRef.current) {
      phase2LoggedRef.current = true;
      const startTime = performance.now();

      // Si offline, ne jamais rediriger vers /app/login
      if (isOffline) {
        return;
      }

      // Si pas d'utilisateur, rediriger vers /app/login
      if (authStatus === 'unauthenticated') {
        logToServer('[PHASE 2] 🔐 Auth local - Aucun utilisateur → Redirection vers /app/login');
        const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
        const searchParams = typeof window !== 'undefined' 
          ? new URLSearchParams(window.location.search)
          : new URLSearchParams();
        
        // Construire l'URL de redirection avec les paramètres actuels
        const redirectParams = searchParams.toString();
        const redirectUrl = redirectParams 
          ? `/app?${redirectParams}`
          : '/app?view=dashboard';
        
        const loginUrl = `/app/login?redirect=${encodeURIComponent(redirectUrl)}`;
        router.push(loginUrl);
        return;
      }

      // Utilisateur trouvé - log unique optimisé
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      const mode = isOffline ? 'offline' : 'online';
      logToServer(`[PHASE 2] 🔐 Auth local - Utilisateur authentifié (${mode}) - ${duration}ms`);
    }
  }, [authStatus, pathname, router, isOffline, user]);

  // Afficher un loader pendant le chargement
  if (authStatus === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#E3EEFA]">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg text-sky-500 mb-4"></div>
          <p className="text-slate-600">Vérification de l'authentification...</p>
        </div>
      </div>
    );
  }

  // Si offline et pas d'utilisateur local, afficher l'écran bloquant
  if (isOffline && (!user || dbReady !== 'ready')) {
    return (
      <InitialOnlineRequiredScreen
        onOnline={() => {
          setDbReady('unknown');
        }}
      />
    );
  }

  // Si appareil de confiance activé et PIN non validé, afficher l'écran de verrouillage
  if (user && trustReady && trustEnabled && !pinUnlocked) {
    return (
      <PinLockScreen
        onUnlock={() => {
          refreshTrustState();
        }}
      />
    );
  }

  // Proposer la configuration du trust après login ONLINE (une seule fois)
  if (!isOffline && user && trustReady && shouldPromptTrust) {
    return (
      <PinSetupScreen
        onComplete={() => {
          refreshTrustState();
        }}
        onSkip={() => {
          dismissTrustPrompt();
          refreshTrustState();
        }}
      />
    );
  }

  // Si pas d'utilisateur (online), ne rien afficher (redirection en cours)
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#E3EEFA]">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg text-sky-500 mb-4"></div>
          <p className="text-slate-600">Redirection vers la page de connexion...</p>
        </div>
      </div>
    );
  }

  // Utilisateur authentifié, afficher le contenu
  return <>{children}</>;
}
