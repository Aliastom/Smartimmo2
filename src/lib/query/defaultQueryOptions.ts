/**
 * Options par défaut pour les queries React Query dans l'application Smartimmo
 * Pattern offline-first avec garde-fous pour éviter les blinks/oscillations
 */

import { UseQueryOptions } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';

/**
 * Options standard pour les queries de type "liste" (données tabulaires)
 * - Garde les données précédentes pendant le refetch (évite le blink)
 * - Stale time modéré (30s) pour éviter les refetch trop fréquents
 * - Pas de refetch automatique sur focus (app backoffice)
 * - Refetch on reconnect activé (sync se déclenche au retour online)
 * - Retry limité aux erreurs réseau
 */
export function getDefaultListQueryOptions<TData = unknown, TError = Error>(
  overrides?: Partial<UseQueryOptions<TData, TError>>
): Partial<UseQueryOptions<TData, TError>> {
  return {
    staleTime: 30_000, // 30 secondes
    refetchOnWindowFocus: false, // App backoffice, pas besoin de refetch auto
    // refetchOnMount : laisser comportement par défaut (staleTime contrôle)
    refetchOnReconnect: true, // Sync se déclenche au retour online, on veut refetch
    retry: 1, // Retry uniquement sur erreurs réseau (1 tentative)
    placeholderData: keepPreviousData, // Garde les données précédentes pendant refetch
    ...overrides,
  };
}

/**
 * Options standard pour les queries de type "charts" (graphiques)
 * - Même pattern que les listes mais staleTime plus long (2min)
 * - Les graphiques changent moins souvent
 */
export function getDefaultChartsQueryOptions<TData = unknown, TError = Error>(
  overrides?: Partial<UseQueryOptions<TData, TError>>
): Partial<UseQueryOptions<TData, TError>> {
  return {
    staleTime: 120_000, // 2 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: 1,
    placeholderData: keepPreviousData,
    ...overrides,
  };
}

/**
 * Options standard pour les queries de type "détail" (une seule entité)
 * - StaleTime plus court (10s) car les détails peuvent changer plus souvent
 * - PAS de keepPreviousData (risque d'afficher un ancien détail)
 * - Comportement par défaut pour refetchOnMount (pas de false global)
 */
export function getDefaultDetailQueryOptions<TData = unknown, TError = Error>(
  overrides?: Partial<UseQueryOptions<TData, TError>>
): Partial<UseQueryOptions<TData, TError>> {
  return {
    staleTime: 10_000, // 10 secondes
    refetchOnWindowFocus: false,
    // refetchOnMount : laisser comportement par défaut
    refetchOnReconnect: true, // Sync se déclenche au retour online
    retry: 1,
    // PAS de placeholderData: keepPreviousData (risque d'afficher ancien détail)
    ...overrides,
  };
}

