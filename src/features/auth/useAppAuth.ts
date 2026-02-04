'use client';

/**
 * Hook d'authentification pour le mode App Shell
 * Gère l'auth online (Supabase) et offline (localStorage)
 */

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

const LOCAL_USER_KEY = 'appShell_localUser';

export type LocalUser = {
  id: string;
  email: string;
  name?: string;
};

export type AppAuthState = {
  user: User | LocalUser | null;
  localUser: LocalUser | null;
  loading: boolean;
  authReady: boolean; // Nouveau : indique que l'auth est prête (user chargé + organizationId disponible)
  organizationId: string | undefined; // Nouveau : organizationId centralisé
  isOffline: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
};

const SESSION_TIMEOUT_MS = 6000;

/**
 * Hook d'authentification App Shell
 * - Online : utilise Supabase pour vérifier la session
 * - Offline : utilise localStorage pour récupérer localUser
 */
export function useAppAuth(): AppAuthState {
  const [user, setUser] = useState<User | LocalUser | null>(null);
  const [localUser, setLocalUser] = useState<LocalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | undefined>(undefined);
  const [isOffline, setIsOffline] = useState(false);

  // Détecter online/offline
  useEffect(() => {
    const updateOnlineStatus = () => {
      const online = typeof navigator !== 'undefined' && navigator.onLine;
      setIsOffline(!online);
    };

    updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // Charger localUser depuis localStorage
  const loadLocalUser = useCallback((): LocalUser | null => {
    if (typeof window === 'undefined') return null;
    
    try {
      const stored = localStorage.getItem(LOCAL_USER_KEY);
      if (stored) {
        return JSON.parse(stored) as LocalUser;
      }
    } catch (error) {
      console.error('[useAppAuth] Erreur lecture localUser:', error);
    }
    return null;
  }, []);

  // Sauvegarder localUser dans localStorage
  const saveLocalUser = useCallback((localUserData: LocalUser | null) => {
    if (typeof window === 'undefined') return;
    
    try {
      if (localUserData) {
        localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(localUserData));
      } else {
        localStorage.removeItem(LOCAL_USER_KEY);
      }
      setLocalUser(localUserData);
    } catch (error) {
      console.error('[useAppAuth] Erreur sauvegarde localUser:', error);
    }
  }, []);

  // Vérifier la session Supabase (online uniquement)
  // ⚠️ OPTIMISÉ : organizationId est maintenant chargé via useAppSession (React Query)
  const checkSupabaseSession = useCallback(async () => {
    if (isOffline) {
      // En offline, ignorer Supabase
      const stored = loadLocalUser();
      setUser(stored);
      const storedOrgId = localStorage.getItem('organizationId');
      if (storedOrgId) setOrganizationId(storedOrgId);
      setLoading(false);
      setAuthReady(true);
      return;
    }

    try {
      const supabase = createBrowserClient();
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('SUPABASE_SESSION_TIMEOUT')), SESSION_TIMEOUT_MS);
      });
      const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]);

      if (error) {
        console.warn('[useAppAuth] Erreur session Supabase:', error);
        // En cas d'erreur, essayer localUser
        const stored = loadLocalUser();
        setUser(stored);
        const storedOrgId = localStorage.getItem('organizationId');
        if (storedOrgId) setOrganizationId(storedOrgId);
        setLoading(false);
        setAuthReady(true);
        return;
      }

      if (session?.user) {
        // Session Supabase valide
        setUser(session.user);
        
        // Sauvegarder aussi en localUser pour l'offline
        const userData: LocalUser = {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.name || session.user.user_metadata?.full_name || undefined,
        };
        saveLocalUser(userData);
        
        // ⚠️ OPTIMISÉ : organizationId sera chargé via useAppSession (pas d'appel API ici)
        // Essayer de récupérer depuis localStorage (peut être mis à jour par useAppSession)
        const storedOrgId = localStorage.getItem('organizationId');
        if (storedOrgId) setOrganizationId(storedOrgId);
      } else {
        // Pas de session Supabase, essayer localUser
        const stored = loadLocalUser();
        setUser(stored);
        // Essayer de récupérer organizationId depuis localStorage
        const storedOrgId = localStorage.getItem('organizationId');
        if (storedOrgId) setOrganizationId(storedOrgId);
      }
    } catch (error) {
      console.error('[useAppAuth] Erreur vérification session:', error);
      if (error instanceof Error && error.message === 'SUPABASE_SESSION_TIMEOUT') {
        console.warn('[useAppAuth] Session Supabase timeout, fallback localUser');
      }
      // En cas d'erreur, essayer localUser
      const stored = loadLocalUser();
      setUser(stored);
      const storedOrgId = localStorage.getItem('organizationId');
      if (storedOrgId) setOrganizationId(storedOrgId);
    } finally {
      setLoading(false);
      // Auth est prête une fois que loading est false ET qu'on a un user ou qu'on sait qu'il n'y en a pas
      setAuthReady(true);
    }
  }, [isOffline, loadLocalUser, saveLocalUser]);

  // Écouter les changements de session Supabase
  useEffect(() => {
    if (isOffline) {
      // En offline, charger uniquement depuis localStorage
      const stored = loadLocalUser();
      setUser(stored);
      setLocalUser(stored);
      const storedOrgId = localStorage.getItem('organizationId');
      if (storedOrgId) setOrganizationId(storedOrgId);
      setLoading(false);
      setAuthReady(true);
      return;
    }

    const supabase = createBrowserClient();
    
    // Vérifier la session initiale
    checkSupabaseSession();

    // Écouter les changements d'auth
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Logger uniquement les événements importants (pas INITIAL_SESSION répétitif)
      if (event !== 'INITIAL_SESSION') {
        console.log('[useAppAuth] Auth state change:', event, session?.user?.email);
      }
      
      if (session?.user) {
        setUser(session.user);
        
        // Sauvegarder en localUser pour l'offline
        const userData: LocalUser = {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.name || session.user.user_metadata?.full_name || undefined,
        };
        saveLocalUser(userData);
        
        // ⚠️ OPTIMISÉ : organizationId sera chargé via useAppSession (pas d'appel API ici)
        // Essayer de récupérer depuis localStorage (peut être mis à jour par useAppSession)
        const storedOrgId = localStorage.getItem('organizationId');
        if (storedOrgId) setOrganizationId(storedOrgId);
        
        setLoading(false);
        setAuthReady(true);
      } else {
        // Session expirée ou déconnexion
        const stored = loadLocalUser();
        setUser(stored);
        const storedOrgId = localStorage.getItem('organizationId');
        if (storedOrgId) setOrganizationId(storedOrgId);
        setLoading(false);
        setAuthReady(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isOffline, checkSupabaseSession, loadLocalUser, saveLocalUser]);

  // Connexion avec Google
  const loginWithGoogle = useCallback(async () => {
    if (isOffline) {
      throw new Error('Connexion impossible hors-ligne');
    }

    try {
      const supabase = createBrowserClient();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      const redirectTo = `${appUrl}/auth/callback?redirect=${encodeURIComponent('/app?view=dashboard')}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error('[useAppAuth] Erreur connexion Google:', error);
      throw error;
    }
  }, [isOffline]);

  // Déconnexion
  const logout = useCallback(async () => {
    try {
      // Déconnexion Supabase (si online)
      if (!isOffline) {
        const supabase = createBrowserClient();
        await supabase.auth.signOut();
      }
      
      // Supprimer localUser
      saveLocalUser(null);
      setUser(null);
      setLocalUser(null);
    } catch (error) {
      console.error('[useAppAuth] Erreur déconnexion:', error);
      // Même en cas d'erreur, supprimer localUser
      saveLocalUser(null);
      setUser(null);
      setLocalUser(null);
    }
  }, [isOffline, saveLocalUser]);

  return {
    user,
    localUser,
    loading,
    authReady,
    organizationId,
    isOffline,
    loginWithGoogle,
    logout,
  };
}
