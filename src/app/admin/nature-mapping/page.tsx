'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Tooltip } from '@/components/ui/Tooltip';
import { toast } from 'sonner';

// Types
interface NatureMappingRule {
  allowedTypes: string[];
  defaultCategoryId?: string;
}

interface NatureMappingRules {
  [natureKey: string]: NatureMappingRule;
}

interface Category {
  id: string;
  label: string;
  type: string;
  actif: boolean;
}

// Constantes
const NATURE_KEYS = [
  'RECETTE_LOYER',
  'RECETTE_AUTRE', 
  'DEPENSE_ENTRETIEN',
  'DEPENSE_ASSURANCE',
  'DEPENSE_TAXE',
  'DEPENSE_BANQUE',
];

const CATEGORY_TYPES = [
  'REVENU',
  'LOYER',
  'DIVERS',
  'BANQUE',
  'ENTRETIEN',
  'ASSURANCE',
  'TAXE_FONCIERE',
];

export default function NatureMappingAdminPage() {
  const [rules, setRules] = useState<NatureMappingRules>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Charger les données
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Charger le mapping et les catégories en parallèle
      const [mappingResponse, categoriesResponse] = await Promise.all([
        fetch('/api/admin/nature-mapping'),
        fetch('/api/accounting/categories'),
      ]);

      if (!mappingResponse.ok || !categoriesResponse.ok) {
        throw new Error('Erreur lors du chargement des données');
      }

      const mappingData = await mappingResponse.json();
      const categoriesData = await categoriesResponse.json();

      setRules(mappingData.DocumentExtractionRule || {});
      setCategories(categoriesData.data || categoriesData || []);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  // Toggle d'un type autorisé
  const toggleAllowedType = (natureKey: string, categoryType: string) => {
    setRules(prev => {
      const newRules = { ...prev };
      if (!newRules[natureKey]) {
        newRules[natureKey] = { allowedTypes: [] };
      }

      const allowedTypes = [...newRules[natureKey].allowedTypes];
      const index = allowedTypes.indexOf(categoryType);
      
      if (index > -1) {
        allowedTypes.splice(index, 1);
      } else {
        allowedTypes.push(categoryType);
      }

      // Vérifier si la catégorie par défaut actuelle est encore compatible
      let defaultCategoryId = newRules[natureKey].defaultCategoryId;
      if (defaultCategoryId) {
        const defaultCategory = categories.find(c => c.id === defaultCategoryId);
        if (defaultCategory && !allowedTypes.includes(defaultCategory.type)) {
          // La catégorie par défaut n'est plus compatible, la vider
          defaultCategoryId = undefined;
        }
      }

      newRules[natureKey] = {
        ...newRules[natureKey],
        allowedTypes,
        defaultCategoryId,
      };

      return newRules;
    });
  };

  // Changer la catégorie par défaut
  const setDefaultCategory = (natureKey: string, categoryId: string | undefined) => {
    setRules(prev => ({
      ...prev,
      [natureKey]: {
        ...prev[natureKey],
        defaultCategoryId: categoryId,
      },
    }));
  };

  // Sauvegarder
  const handleSave = async () => {
    try {
      setSaving(true);
      
      const response = await fetch('/api/admin/nature-mapping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rules }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la sauvegarde');
      }

      toast.success('Mapping sauvegardé avec succès');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Réinitialiser avec les données par défaut
  const handleReset = async () => {
    try {
      setSaving(true);
      
      const response = await fetch('/api/admin/nature-mapping/reset', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la réinitialisation');
      }

      await loadData();
      toast.success('Mapping réinitialisé avec les valeurs par défaut');
    } catch (error) {
      console.error('Erreur lors de la réinitialisation:', error);
      toast.error('Erreur lors de la réinitialisation');
    } finally {
      setSaving(false);
    }
  };

  // Obtenir les catégories compatibles pour une nature
  const getCompatibleCategories = (natureKey: string) => {
    const allowedTypes = rules[natureKey]?.allowedTypes || [];
    return categories.filter(cat => 
      cat.actif && allowedTypes.includes(cat.type)
    );
  };

  // Vérifier si au moins un type est autorisé pour une nature
  const hasAllowedTypes = (natureKey: string) => {
    const allowedTypes = rules[natureKey]?.allowedTypes || [];
    return allowedTypes.length > 0;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="loading loading-spinner loading-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Mapping Nature ↔ Catégorie</h1>
          <p className="text-gray-600 mt-1">
            Configurez quelles catégories sont autorisées pour chaque nature de transaction
          </p>
        </div>
        
        <div className="flex gap-2">
          <Tooltip content="Réinitialiser avec les valeurs par défaut">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={saving}
            >
              🔄 Réinitialiser
            </Button>
          </Tooltip>
          
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary"
          >
            {saving ? '💾 Sauvegarde...' : '💾 Enregistrer'}
          </Button>
        </div>
      </div>

      {/* Aide */}
      <Card className="mb-6 p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <div className="text-blue-600 text-xl">ℹ️</div>
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">Comment ça marche ?</h3>
            <ul className="text-blue-800 text-sm space-y-1">
              <li>• <strong>Cochez</strong> les types de catégories autorisés pour chaque nature</li>
              <li>• <strong>Sélectionnez</strong> une catégorie par défaut (optionnel)</li>
              <li>• Dans la modal Transaction, seules les catégories compatibles seront proposées</li>
              <li>• La catégorie par défaut sera pré-sélectionnée automatiquement</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Tableau de mapping */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th className="bg-gray-50 font-semibold">Nature</th>
                {CATEGORY_TYPES.map(type => (
                  <th key={type} className="bg-gray-50 font-semibold text-center">
                    {type}
                  </th>
                ))}
                <th className="bg-gray-50 font-semibold">Catégorie par défaut</th>
              </tr>
            </thead>
            <tbody>
              {NATURE_KEYS.map(natureKey => {
                const rule = rules[natureKey] || { allowedTypes: [] };
                const compatibleCategories = getCompatibleCategories(natureKey);
                
                return (
                  <tr key={natureKey} className="hover:bg-gray-50">
                    <td className="font-medium">
                      <Badge variant="outline">
                        {natureKey.replace('_', ' ')}
                      </Badge>
                    </td>
                    
                    {CATEGORY_TYPES.map(categoryType => {
                      const isAllowed = rule.allowedTypes.includes(categoryType);
                      return (
                        <td key={categoryType} className="text-center">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-primary"
                            checked={isAllowed}
                            onChange={() => toggleAllowedType(natureKey, categoryType)}
                          />
                        </td>
                      );
                    })}
                    
                    <td>
                      <select
                        className="select select-bordered select-sm w-full max-w-xs"
                        value={rule.defaultCategoryId || ''}
                        onChange={(e) => setDefaultCategory(natureKey, e.target.value || undefined)}
                        disabled={!hasAllowedTypes(natureKey)}
                      >
                        <option value="">
                          {!hasAllowedTypes(natureKey)
                            ? 'Cochez au moins un type'
                            : compatibleCategories.length === 0
                            ? 'Aucune catégorie compatible'
                            : 'Sélectionner...'
                          }
                        </option>
                        {compatibleCategories.map(category => (
                          <option key={category.id} value={category.id}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                      {hasAllowedTypes(natureKey) && compatibleCategories.length === 0 && (
                        <div className="mt-1 text-xs text-amber-600">
                          <a 
                            href="/admin/categories" 
                            target="_blank"
                            className="underline hover:text-amber-800"
                          >
                            Créer une catégorie
                          </a>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Résumé */}
      <Card className="mt-6 p-4">
        <h3 className="font-semibold mb-3">📊 Résumé de la configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <strong>Natures configurées :</strong> {Object.keys(rules).length}
          </div>
          <div>
            <strong>Total des règles :</strong> {
              Object.values(rules).reduce((sum, rule) => sum + rule.allowedTypes.length, 0)
            }
          </div>
        </div>
      </Card>
    </div>
  );
}