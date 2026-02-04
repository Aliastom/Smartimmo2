import { useState, useEffect } from 'react';

const STORAGE_KEY = 'smartimmo_gestion_enable';

/**
 * Hook pour récupérer le statut d'activation de la gestion déléguée
 * Vérifie les settings en BDD au lieu du .env
 * En mode offline/app-shell : utilise localStorage, sinon API
 */
export function useGestionDelegueStatus() {
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchStatus() {
      try {
        // ✅ D'abord essayer localStorage (mode offline/app-shell)
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored !== null) {
            const enabled = stored === 'true';
            if (isMounted) {
              setIsEnabled(enabled);
              setIsLoading(false);
            }
            // Charger depuis l'API en arrière-plan pour mettre à jour le cache
            // (non-bloquant) - SEULEMENT si on est en ligne
            if (typeof navigator !== 'undefined' && navigator.onLine) {
              fetch('/api/settings?prefix=gestion.enable')
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                  const enabled = data?.settings?.['gestion.enable'] ?? false;
                  localStorage.setItem(STORAGE_KEY, String(enabled));
                  if (isMounted) {
                    setIsEnabled(enabled);
                  }
                })
                .catch(() => {
                  // Erreur silencieuse, on garde la valeur du localStorage
                });
            }
            return; // On a une valeur, on sort
          }
        } catch (localStorageError) {
          // localStorage non disponible, continuer avec l'API
        }
        
        // Fallback : charger depuis l'API
        const response = await fetch('/api/settings?prefix=gestion.enable');
        if (response.ok && isMounted) {
          const data = await response.json();
          const enabled = data.settings?.['gestion.enable'] ?? false;
          setIsEnabled(enabled);
          
          // Mettre en cache dans localStorage
          try {
            localStorage.setItem(STORAGE_KEY, String(enabled));
          } catch (e) {
            // Ignorer les erreurs localStorage
          }
        } else {
          // En cas d'erreur, on considère la feature comme désactivée
          setIsEnabled(false);
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

