'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface Category {
  id: string;
  slug: string;
  label: string;
  type: 'REVENU' | 'DEPENSE' | 'NON_DEFINI';
  deductible: boolean;
  capitalizable: boolean;
  system: boolean;
  actif: boolean;
}

interface CategorySelectorProps {
  value?: string;
  onChange: (categoryId: string) => void;
  nature?: string;
  disabled?: boolean;
  required?: boolean;
}

// Mapping Nature → Catégorie par défaut
const NATURE_TO_CATEGORY_MAPPING: Record<string, string> = {
  'LOYER': 'loyer',
  'CHARGES': 'charges-locatives',
  'DEPOT_GARANTIE_RECU': 'depot-garantie',
  'DEPOT_GARANTIE_RENDU': 'depot-garantie',
  'AVOIR_REGULARISATION': 'avoir-regularisation',
  'PENALITE_RETENUE': 'penalite-retard',
  'AUTRE': 'autre'
};

export default function CategorySelector({ 
  value, 
  onChange, 
  nature, 
  disabled = false, 
  required = false 
}: CategorySelectorProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (nature && categories.length > 0) {
      // Auto-sélection basée sur la nature
      const defaultSlug = NATURE_TO_CATEGORY_MAPPING[nature];
      if (defaultSlug) {
        const defaultCategory = categories.find(cat => cat.slug === defaultSlug);
        if (defaultCategory && !value) {
          onChange(defaultCategory.id);
        }
      }
    }
  }, [nature, categories, value]); // Retiré onChange des dépendances

  useEffect(() => {
    if (value && categories.length > 0) {
      const category = categories.find(cat => cat.id === value);
      setSelectedCategory(category || null);
    } else {
      setSelectedCategory(null);
    }
  }, [value, categories]);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data.filter((cat: Category) => cat.actif));
      }
    } catch (error) {
      console.error('Erreur lors du chargement des catégories:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryTypeColor = (type: string) => {
    switch (type) {
      case 'REVENU': return 'success';
      case 'DEPENSE': return 'danger';
      default: return 'gray';
    }
  };

  const getCategoryTypeLabel = (type: string) => {
    switch (type) {
      case 'REVENU': return 'Revenu';
      case 'DEPENSE': return 'Dépense';
      default: return 'Non défini';
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          Catégorie {required && <span className="text-red-500">*</span>}
        </label>
        <div className="animate-pulse bg-gray-200 h-10 rounded-md"></div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">
        Catégorie {required && <span className="text-red-500">*</span>}
      </label>
      
      {selectedCategory ? (
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
          <div className="flex items-center gap-3">
            <div>
              <div className="font-medium text-gray-900">{selectedCategory.label}</div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={getCategoryTypeColor(selectedCategory.type)} size="sm">
                  {getCategoryTypeLabel(selectedCategory.type)}
                </Badge>
                {selectedCategory.deductible && (
                  <Badge variant="info" size="sm">Déductible</Badge>
                )}
                {selectedCategory.capitalizable && (
                  <Badge variant="warning" size="sm">Capitalisable</Badge>
                )}
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange('')}
            disabled={disabled}
          >
            Changer
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => onChange(category.id)}
                disabled={disabled}
                className="flex items-center justify-between p-3 text-left border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div>
                  <div className="font-medium text-gray-900">{category.label}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={getCategoryTypeColor(category.type)} size="sm">
                      {getCategoryTypeLabel(category.type)}
                    </Badge>
                    {category.deductible && (
                      <Badge variant="info" size="sm">Déductible</Badge>
                    )}
                    {category.capitalizable && (
                      <Badge variant="warning" size="sm">Capitalisable</Badge>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
