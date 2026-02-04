import { useState, useEffect, useCallback } from 'react';

// Types
export interface NatureMappingRule {
  allowedTypes: string[];
  defaultCategoryId?: string;
}

export interface NatureMappingRules {
  [natureKey: string]: NatureMappingRule;
}

export interface Category {
  id: string;
  label: string;
  type: string;
  actif: boolean;
}

interface UseNatureMappingOptions {
  // Permet de passer des données pré-chargées (ex: depuis IndexedDB en mode app-shell)
  natures?: any[];
  categories?: Category[];
  mode?: 'normal' | 'app-shell';
}

// Hook pour gérer le mapping Nature ↔ Catégorie
export function useNatureMapping(options: UseNatureMappingOptions = {}) {
  const { natures: providedNatures, categories: providedCategories, mode = 'normal' } = options;
  const [mapping, setMapping] = useState<NatureMappingRules>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(!providedNatures || !providedCategories);
  const [error, setError] = useState<string | null>(null);

  // Charger depuis IndexedDB en mode app-shell
  const loadMappingFromIndexedDB = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { getLocalDB } = await import('@/lib/offline/db');
      const db = await getLocalDB();

      // Charger depuis IndexedDB
      const [naturesData, categoriesData] = await Promise.all([
        db.NatureEntity.toArray(),
        db.Category.toArray(),
      ]);

      // Transformer les natures en mapping
      const mappingRules: NatureMappingRules = {};
      naturesData.forEach((nature: any) => {
        mappingRules[nature.key] = {
          allowedTypes: nature.compatibleTypes || [],
          defaultCategoryId: nature.defaultCategory
        };
      });

      setMapping(mappingRules);
      setCategories(categoriesData);
      setLoading(false);
    } catch (err) {
      console.error('Erreur lors du chargement du mapping depuis IndexedDB:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      setLoading(false);
    }
  }, []);

  // Charger depuis l'API (mode normal uniquement)
  const loadMapping = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Vérifier si on est en ligne avant de faire des appels API
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        // Si offline, essayer de charger depuis IndexedDB
        console.log('[useNatureMapping] ⚠️ Offline détecté, chargement depuis IndexedDB');
        try {
          const { getLocalDB } = await import('@/lib/offline/db');
          const db = await getLocalDB();
          const [naturesData, categoriesData] = await Promise.all([
            db.NatureEntity.toArray(),
            db.Category.toArray(),
          ]);
          const mappingRules: NatureMappingRules = {};
          naturesData.forEach((nature: any) => {
            mappingRules[nature.key] = {
              allowedTypes: nature.compatibleTypes || [],
              defaultCategoryId: nature.defaultCategory
            };
          });
          setMapping(mappingRules);
          setCategories(categoriesData);
          setLoading(false);
        } catch (err) {
          console.error('Erreur lors du chargement depuis IndexedDB (offline):', err);
          setError('Données non disponibles en mode offline');
          setLoading(false);
        }
        return;
      }

      // Charger les natures et les catégories directement depuis la BDD
      const [naturesResponse, categoriesResponse] = await Promise.all([
        fetch('/api/admin/natures'),
        fetch('/api/accounting/categories'),
      ]);

      if (!naturesResponse.ok) {
        throw new Error('Erreur lors du chargement des natures');
      }

      if (!categoriesResponse.ok) {
        throw new Error('Erreur lors du chargement des catégories');
      }

      const naturesData = await naturesResponse.json();
      const categoriesData = await categoriesResponse.json();

      // Transformer les natures en mapping
      const mappingRules: NatureMappingRules = {};
      naturesData.data?.forEach((nature: any) => {
        mappingRules[nature.key] = {
          allowedTypes: nature.compatibleTypes || [],
          defaultCategoryId: nature.defaultCategory
        };
      });

      setMapping(mappingRules);
      setCategories(categoriesData.data || categoriesData || []);
    } catch (err) {
      console.error('Erreur lors du chargement du mapping Nature ↔ Catégorie:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  // Charger le mapping et les catégories
  useEffect(() => {
    if (providedNatures && providedNatures.length > 0 && providedCategories && providedCategories.length > 0) {
      // Utiliser les données fournies (mode app-shell)
      try {
        setLoading(true);
        console.log('[useNatureMapping] 📦 Mode app-shell - Natures fournies:', providedNatures.length);
        console.log('[useNatureMapping] 📦 Mode app-shell - Catégories fournies:', providedCategories.length);
        
        // Transformer les natures en mapping
        const mappingRules: NatureMappingRules = {};
        providedNatures.forEach((nature: any) => {
          console.log('[useNatureMapping] 🔍 Nature:', nature.key, {
            compatibleTypes: nature.compatibleTypes,
            defaultCategory: nature.defaultCategory,
            hasCompatibleTypes: !!nature.compatibleTypes,
            hasDefaultCategory: !!nature.defaultCategory
          });
          mappingRules[nature.key] = {
            allowedTypes: nature.compatibleTypes || [],
            defaultCategoryId: nature.defaultCategory
          };
        });

        console.log('[useNatureMapping] ✅ Mapping construit:', Object.keys(mappingRules).length, 'natures mappées');
        setMapping(mappingRules);
        setCategories(providedCategories);
        setLoading(false);
      } catch (err) {
        console.error('Erreur lors du traitement du mapping Nature ↔ Catégorie:', err);
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
        setLoading(false);
      }
    } else if (mode === 'app-shell') {
      // Mode app-shell mais données non fournies : charger depuis IndexedDB
      loadMappingFromIndexedDB();
    } else {
      // Charger depuis l'API (mode normal)
      loadMapping();
    }
  }, [providedNatures, providedCategories, mode, loadMappingFromIndexedDB, loadMapping]);

  // Obtenir les catégories compatibles pour une nature
  const getCompatibleCategories = useCallback((natureKey: string): Category[] => {
    const rule = mapping[natureKey];
    if (!rule || !rule.allowedTypes.length) {
      return [];
    }

    return categories.filter(category => 
      category.actif && rule.allowedTypes.includes(category.type)
    );
  }, [mapping, categories]);

  // Obtenir la catégorie par défaut pour une nature
  const getDefaultCategory = useCallback((natureKey: string): Category | null => {
    const rule = mapping[natureKey];
    if (!rule?.defaultCategoryId) {
      return null;
    }

    return categories.find(category => category.id === rule.defaultCategoryId) || null;
  }, [mapping, categories]);

  // Vérifier si une catégorie est compatible avec une nature
  const isCategoryCompatible = useCallback((natureKey: string, categoryId: string): boolean => {
    const compatibleCategories = getCompatibleCategories(natureKey);
    return compatibleCategories.some(cat => cat.id === categoryId);
  }, [getCompatibleCategories]);

  // Obtenir la première catégorie compatible (pour auto-sélection)
  const getFirstCompatibleCategory = useCallback((natureKey: string): Category | null => {
    const compatibleCategories = getCompatibleCategories(natureKey);
    return compatibleCategories.length > 0 ? compatibleCategories[0] : null;
  }, [getCompatibleCategories]);

  return {
    mapping,
    categories,
    loading,
    error,
    loadMapping,
    getCompatibleCategories,
    getDefaultCategory,
    isCategoryCompatible,
    getFirstCompatibleCategory,
  };
}
