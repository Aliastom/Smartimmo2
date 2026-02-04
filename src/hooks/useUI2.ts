/**
 * Hook pour détecter si le mode UI2 est activé
 * UI2 est maintenant activé par défaut
 * Le flag ui2=false dans l'URL permet de désactiver UI2 si nécessaire
 */
'use client';

import { useSearchParams } from 'next/navigation';

export function useUI2(): boolean {
  const searchParams = useSearchParams();
  // UI2 est activé par défaut, sauf si ui2=false est explicitement passé
  return searchParams?.get('ui2') !== 'false';
}

