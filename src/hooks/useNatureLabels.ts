'use client';

import { useState, useEffect } from 'react';
import { getLocalDB } from '@/lib/offline/db';

interface NatureLabel {
  key: string;
  label: string;
}

export function useNatureLabels() {
  const [natureLabels, setNatureLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNatureLabels = async () => {
      try {
        setLoading(true);
        
        // ✅ Essayer d'abord IndexedDB (mode app-shell/offline)
        try {
          const db = await getLocalDB();
          const natures = await db.NatureEntity.toArray();
          if (natures && natures.length > 0) {
            const labels: Record<string, string> = {};
            natures.forEach((nature: any) => {
              labels[nature.key] = nature.label;
            });
            setNatureLabels(labels);
            setLoading(false);
            return; // Succès, on sort
          }
        } catch (indexedDBError) {
          // IndexedDB non disponible, continuer avec l'API
          console.log('[useNatureLabels] IndexedDB non disponible, utilisation API');
        }
        
        // Fallback : charger depuis l'API
        const response = await fetch('/api/natures');
        const data = await response.json();
        
        if (data.success && data.data) {
          // Transformer les données de la BDD en format attendu
          const labels: Record<string, string> = {};
          data.data.forEach((nature: any) => {
            labels[nature.key] = nature.label;
          });
          setNatureLabels(labels);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des libellés de natures:', error);
        // En cas d'erreur, on garde les valeurs par défaut (vides)
      } finally {
        setLoading(false);
      }
    };

    fetchNatureLabels();
  }, []);

  const getNatureLabel = (key: string): string => {
    return natureLabels[key] || getDefaultNatureLabel(key);
  };

  const getDefaultNatureLabel = (key: string): string => {
    const defaultLabels: Record<string, string> = {
      'RECETTE_LOYER': 'Loyer',
      'RECETTE_AUTRE': 'Autre recette',
      'DEPENSE_ENTRETIEN': 'Entretien',
      'DEPENSE_ASSURANCE': 'Assurance',
      'DEPENSE_TAXE': 'Taxe foncière',
      'DEPENSE_BANQUE': 'Frais bancaires'
    };
    return defaultLabels[key] || key;
  };

  return {
    natureLabels,
    getNatureLabel,
    loading
  };
}
