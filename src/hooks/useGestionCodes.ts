import { useState, useEffect } from 'react';

const DEFAULT_CODES = {
  rentNature: 'RECETTE_LOYER',
  rentCategory: 'loyer-charges',
  mgmtNature: 'DEPENSE_GESTION',
  mgmtCategory: 'frais-gestion',
};

const STORAGE_KEY = 'smartimmo_gestion_codes';

/**
 * Hook pour récupérer les codes système de la gestion déléguée
 * (nature et catégorie pour les loyers et les commissions)
 * En mode offline/app-shell : utilise localStorage, sinon API
 */
export function useGestionCodes() {
  const [codes, setCodes] = useState<{
    rentNature: string;
    rentCategory: string;
    mgmtNature: string;
    mgmtCategory: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchCodes() {
      try {
        // ✅ D'abord essayer localStorage (mode offline/app-shell)
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (isMounted) {
              setCodes(parsed);
              setIsLoading(false);
            }
            // Charger depuis l'API en arrière-plan pour mettre à jour le cache
            // (non-bloquant) - SEULEMENT si on est en ligne
            if (typeof navigator !== 'undefined' && navigator.onLine) {
              fetch('/api/settings?prefix=gestion.codes')
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                  if (data?.settings) {
                    const newCodes = {
                      rentNature: data.settings['gestion.codes.rent.nature'] || DEFAULT_CODES.rentNature,
                      rentCategory: data.settings['gestion.codes.rent.Category'] || DEFAULT_CODES.rentCategory,
                      mgmtNature: data.settings['gestion.codes.mgmt.nature'] || DEFAULT_CODES.mgmtNature,
                      mgmtCategory: data.settings['gestion.codes.mgmt.Category'] || DEFAULT_CODES.mgmtCategory,
                    };
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(newCodes));
                    if (isMounted) {
                      setCodes(newCodes);
                    }
                  }
                })
                .catch(() => {
                  // Erreur silencieuse, on garde les valeurs du localStorage
                });
            }
            return; // On a des valeurs, on sort
          }
        } catch (localStorageError) {
          // localStorage non disponible, continuer avec l'API
        }
        
        // Fallback : charger depuis l'API
        const response = await fetch('/api/settings?prefix=gestion.codes');
        if (response.ok && isMounted) {
          const data = await response.json();
          const settings = data.settings || {};
          
          const newCodes = {
            rentNature: settings['gestion.codes.rent.nature'] || DEFAULT_CODES.rentNature,
            rentCategory: settings['gestion.codes.rent.Category'] || DEFAULT_CODES.rentCategory,
            mgmtNature: settings['gestion.codes.mgmt.nature'] || DEFAULT_CODES.mgmtNature,
            mgmtCategory: settings['gestion.codes.mgmt.Category'] || DEFAULT_CODES.mgmtCategory,
          };
          
          // Mettre en cache dans localStorage
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newCodes));
          } catch (e) {
            // Ignorer les erreurs localStorage
          }
          
          setCodes(newCodes);
        } else {
          // En cas d'erreur, utiliser les valeurs par défaut
          setCodes(DEFAULT_CODES);
        }
      } catch (error) {
        console.error('[useGestionCodes] Erreur lors de la récupération des codes:', error);
        // En cas d'erreur, utiliser les valeurs par défaut
        if (isMounted) {
          setCodes(DEFAULT_CODES);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchCodes();

    return () => {
      isMounted = false;
    };
  }, []);

  return { codes, isLoading };
}

