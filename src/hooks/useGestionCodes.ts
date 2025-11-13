import { useState, useEffect } from 'react';

/**
 * Hook pour récupérer les codes système de la gestion déléguée
 * (nature et catégorie pour les loyers et les commissions)
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
        // Récupérer tous les codes gestion
        const response = await fetch('/api/settings?prefix=gestion.codes');
        if (response.ok && isMounted) {
          const data = await response.json();
          const settings = data.settings || {};
          
          setCodes({
            rentNature: settings['gestion.codes.rent.nature'] || 'RECETTE_LOYER',
            rentCategory: settings['gestion.codes.rent.Category'] || 'loyer-charges',
            mgmtNature: settings['gestion.codes.mgmt.nature'] || 'DEPENSE_GESTION',
            mgmtCategory: settings['gestion.codes.mgmt.Category'] || 'frais-gestion',
          });
        }
      } catch (error) {
        console.error('[useGestionCodes] Erreur lors de la récupération des codes:', error);
        // En cas d'erreur, utiliser les valeurs par défaut
        if (isMounted) {
          setCodes({
            rentNature: 'RECETTE_LOYER',
            rentCategory: 'loyer-charges',
            mgmtNature: 'DEPENSE_GESTION',
            mgmtCategory: 'frais-gestion',
          });
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

