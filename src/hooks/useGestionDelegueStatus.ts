import { useState, useEffect } from 'react';

/**
 * Hook pour récupérer le statut d'activation de la gestion déléguée
 * Vérifie les settings en BDD au lieu du .env
 */
export function useGestionDelegueStatus() {
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchStatus() {
      try {
        // Récupérer uniquement le paramètre gestion.enable
        const response = await fetch('/api/settings?prefix=gestion.enable');
        if (response.ok && isMounted) {
          const data = await response.json();
          const enabled = data.settings?.['gestion.enable'] ?? false;
          setIsEnabled(enabled);
        }
      } catch (error) {
        console.error('[useGestionDelegueStatus] Erreur lors de la récupération du statut:', error);
        // En cas d'erreur, on considère la feature comme désactivée
        if (isMounted) {
          setIsEnabled(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  return { isEnabled, isLoading };
}

