/**
 * Hook centralisé pour la session utilisateur (React Query)
 * Garantit un seul appel /api/auth/me par boot AppShell
 */

'use client';

import { useQuery } from '@tanstack/react-query';

export interface AppSession {
  user: {
    id: string;
    email: string;
    name?: string;
  };
  organizationId: string;
}

const SESSION_QUERY_KEY = ['app-session'];

/**
 * Récupère la session depuis l'API (appel unique, mis en cache par React Query)
 */
async function fetchSession(): Promise<AppSession> {
  const res = await fetch('/api/auth/me');
  if (!res.ok) {
    throw new Error('Non authentifié');
  }
  const data = await res.json();
  
  // Sauvegarder organizationId dans localStorage pour usage offline
  if (data.organizationId) {
    localStorage.setItem('organizationId', data.organizationId);
  }
  
  return {
    user: {
      id: data.id || data.userId || '',
      email: data.email || '',
      name: data.name || undefined,
    },
    organizationId: data.organizationId || localStorage.getItem('organizationId') || 'default',
  };
}

/**
 * Hook pour récupérer la session (cache React Query)
 * - Un seul appel /api/auth/me par boot
 * - Réutilise le cache pour tous les composants
 */
export function useAppSession() {
  const { data, isLoading, error, refetch } = useQuery<AppSession>({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchSession,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (anciennement cacheTime)
    retry: 1,
    // En mode offline, utiliser localStorage
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Fallback offline : utiliser localStorage
  const offlineOrgId = typeof window !== 'undefined' ? localStorage.getItem('organizationId') : undefined;
  
  return {
    session: data,
    organizationId: data?.organizationId || offlineOrgId || undefined,
    isLoading,
    error,
    refetch,
  };
}




