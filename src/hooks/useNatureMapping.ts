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

// Hook pour gérer le mapping Nature ↔ Catégorie
export function useNatureMapping() {
  const [mapping, setMapping] = useState<NatureMappingRules>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Charger le mapping et les catégories
  useEffect(() => {
    loadMapping();
  }, []);

  const loadMapping = async () => {
    try {
      setLoading(true);
      setError(null);

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
  };

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
