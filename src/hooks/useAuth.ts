/**
 * Hook centralisé pour gérer l'authentification
 * Utilise React Query pour éviter les appels multiples et les intervalles inutiles
 */

import { useQuery } from '@tanstack/react-query';

export interface UserInfo {
  id: string;
  name: string | null;
  email: string;
  role: string;
  emailVerified: Date | null;
}

interface AuthResponse {
  user: UserInfo;
}

/**
 * Hook pour récupérer l'utilisateur connecté
 * - Utilise React Query avec cache de 10 minutes
 * - Pas de refetch automatique (l'utilisateur ne change pas souvent)
 * - Peut être invalidé manuellement si nécessaire (ex: après login/logout)
 */
export function useAuth() {
  const { data, isLoading, error, refetch } = useQuery<AuthResponse | null>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const response = await fetch('/api/auth/me');
      if (!response.ok) {
        if (response.status === 401) {
          return null; // Non authentifié
        }
        throw new Error('Erreur lors de la récupération du profil');
      }
      return response.json();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes (l'utilisateur ne change pas souvent)
    gcTime: 30 * 60 * 1000, // 30 minutes en cache
    retry: 1,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  return {
    user: data?.user ?? null,
    isAuthenticated: !!data?.user,
    isLoading,
    error,
    refetch, // Permet de forcer un refresh si nécessaire (ex: après login)
  };
}

