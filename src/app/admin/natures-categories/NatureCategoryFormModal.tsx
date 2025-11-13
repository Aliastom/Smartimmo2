'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Tabs } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/shared/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { toast } from 'sonner';

interface Nature {
  key: string;
  label: string;
  flow: 'INCOME' | 'EXPENSE';
  active: boolean;
  compatibleTypes: string[];
  defaultCategory?: string;
}

interface Category {
  key: string;
  label: string;
  type: string;
  active: boolean;
}

interface NatureCategoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'nature' | 'category';
  item?: Nature | Category | null;
  categories: Category[];
  onSave: (data: any) => Promise<void>;
}

export default function NatureCategoryFormModal({
  isOpen,
  onClose,
  mode,
  item,
  categories,
  onSave
}: NatureCategoryFormModalProps) {
  const [activeTab, setActiveTab] = useState('general');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  
  // États du formulaire
  const [formData, setFormData] = useState({
    key: '',
    label: '',
    flow: 'INCOME' as 'INCOME' | 'EXPENSE',
    active: true,
    compatibleTypes: [] as string[],
    defaultCategory: '',
    type: '', // Pour les catégories
    deductible: false, // Charge déductible
    capitalizable: false // Charge capitalizable
  });

  // Types de catégories disponibles
  const categoryTypes = [
    'REVENU',
    'LOYER', 
    'DIVERS',
    'BANQUE',
    'ENTRETIEN',
    'ASSURANCE',
    'TAXE_FONCIERE'
  ];

  // État pour les catégories filtrées
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  const [categoriesWithIds, setCategoriesWithIds] = useState<any[]>([]);
  
  // Charger les catégories avec leurs IDs depuis l'API
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await fetch('/api/accounting/categories');
        if (response.ok) {
          const data = await response.json();
          setCategoriesWithIds(data.data || data || []);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des catégories:', error);
      }
    };
    loadCategories();
  }, []);
  
  // Filtrer les catégories quand les types compatibles changent
  useEffect(() => {
    if (mode === 'nature' && formData.compatibleTypes.length > 0) {
      const filtered = categoriesWithIds.filter(cat => 
        cat.actif && formData.compatibleTypes.includes(cat.type)
      );
      setFilteredCategories(filtered);
      
      // Vérifier si la catégorie par défaut actuelle est toujours compatible
      if (formData.defaultCategory) {
        const isStillCompatible = filtered.some(cat => cat.id === formData.defaultCategory);
        if (!isStillCompatible) {
          setFormData(prev => ({ ...prev, defaultCategory: '' }));
          toast.warning('Catégorie par défaut incompatible avec les types sélectionnés.');
        }
      }
    } else {
      setFilteredCategories([]);
    }
  }, [formData.compatibleTypes, categoriesWithIds, mode]);
  
  // Initialiser le formulaire
  useEffect(() => {
    if (item) {
      if (mode === 'nature') {
        const nature = item as Nature;
        setFormData({
          key: nature.key,
          label: nature.label,
          flow: nature.flow,
          active: nature.active,
          compatibleTypes: nature.compatibleTypes,
          defaultCategory: nature.defaultCategory || '',
          type: ''
        });
      } else {
        const category = item as any;
        setFormData({
          key: category.key,
          label: category.label,
          flow: 'INCOME',
          active: category.active,
          compatibleTypes: [],
          defaultCategory: '',
          type: category.type,
          deductible: category.deductible || false,
          capitalizable: category.capitalizable || false
        });
      }
    } else {
      // Nouvel élément
      setFormData({
        key: '',
        label: '',
        flow: 'INCOME',
        active: true,
        compatibleTypes: [],
        defaultCategory: '',
        type: '',
        deductible: false,
        capitalizable: false
      });
    }
  }, [item, mode, isOpen]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCompatibleTypeToggle = (type: string) => {
    setFormData(prev => ({
      ...prev,
      compatibleTypes: prev.compatibleTypes.includes(type)
        ? prev.compatibleTypes.filter(t => t !== type)
        : [...prev.compatibleTypes, type]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Réinitialiser les erreurs
    setErrors({});
    
    // Validation des champs obligatoires
    if (!formData.key || !formData.label) {
      setErrors({ general: 'Le code et le libellé sont obligatoires' });
      toast.error('Le code et le libellé sont obligatoires');
      return;
    }

    if (mode === 'nature' && formData.compatibleTypes.length === 0) {
      setErrors({ mapping: 'Au moins un type de catégorie compatible doit être sélectionné' });
      toast.error('Au moins un type de catégorie compatible doit être sélectionné');
      return;
    }

    if (mode === 'category' && !formData.type) {
      setErrors({ type: 'Le type (taxonomie) est obligatoire pour créer une catégorie' });
      toast.error('Le type (taxonomie) est obligatoire pour créer une catégorie');
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('[FORM MODAL] Données envoyées:', formData);
      console.log('[FORM MODAL] deductible:', formData.deductible);
      console.log('[FORM MODAL] capitalizable:', formData.capitalizable);
      
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      key: '',
      label: '',
      flow: 'INCOME',
      active: true,
      compatibleTypes: [],
      defaultCategory: '',
      type: '',
      deductible: false,
      capitalizable: false
    });
    setActiveTab('general');
    setErrors({});
    onClose();
  };

  // Générer l'aperçu JSON
  const generateJsonPreview = () => {
    if (mode === 'nature') {
      return {
        natures: [{
          key: formData.key,
          label: formData.label,
          flow: formData.flow,
          active: formData.active
        }],
        mappings: [{
          nature: formData.key,
          types: formData.compatibleTypes,
          defaultCategory: formData.defaultCategory || undefined
        }]
      };
    } else {
      return {
        categories: [{
          key: formData.key,
          label: formData.label,
          type: formData.type,
          active: formData.active,
          deductible: formData.deductible,
          capitalizable: formData.capitalizable
        }]
      };
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {item ? 'Modifier' : 'Créer'} {mode === 'nature' ? 'une nature' : 'une catégorie'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex">
              <button
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'general'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('general')}
              >
                Informations générales
              </button>
              {mode === 'nature' && (
                <button
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'mapping'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => setActiveTab('mapping')}
                >
                  Mapping
                </button>
              )}
              <button
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'preview'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('preview')}
              >
                Aperçu JSON
              </button>
            </div>
          </Tabs>
        </div>

        {/* Contenu du formulaire */}
        <form onSubmit={handleSubmit} className="p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="key" className="text-sm font-medium text-gray-700">
                    Code *
                  </Label>
                  <Input
                    id="key"
                    value={formData.key}
                    onChange={(e) => handleInputChange('key', e.target.value.toUpperCase())}
                    placeholder={mode === 'nature' ? 'RECETTE_LOYER' : 'LOYER'}
                    disabled={!!item} // Readonly si édition
                    className={item ? 'bg-gray-100' : ''}
                  />
                  {item && (
                    <p className="text-xs text-gray-500 mt-1">Le code ne peut pas être modifié</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="label" className="text-sm font-medium text-gray-700">
                    Libellé *
                  </Label>
                  <Input
                    id="label"
                    value={formData.label}
                    onChange={(e) => handleInputChange('label', e.target.value)}
                    placeholder={mode === 'nature' ? 'Loyer' : 'Loyer principal'}
                  />
                </div>
              </div>

              {mode === 'nature' ? (
                <div>
                  <Label htmlFor="flow" className="text-sm font-medium text-gray-700">
                    Type de flux *
                  </Label>
                  <Select value={formData.flow} onValueChange={(value: 'INCOME' | 'EXPENSE') => handleInputChange('flow', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INCOME">Recette</SelectItem>
                      <SelectItem value="EXPENSE">Dépense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <Label htmlFor="type" className="text-sm font-medium text-gray-700">
                    Type (taxonomie) *
                  </Label>
                  <Select value={formData.type} onValueChange={(value) => handleInputChange('type', value)}>
                    <SelectTrigger className={errors.type ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Sélectionner un type (obligatoire)" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryTypes.length > 0 ? (
                        categoryTypes.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))
                      ) : (
                        <div className="p-4 text-center">
                          <div className="text-sm text-gray-500 mb-2">
                            Aucun type de catégorie configuré
                          </div>
                          <a 
                            href="/admin/natures-categories" 
                            target="_blank"
                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                          >
                            Configurer les types
                          </a>
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    Le type est une taxonomie technique (LOYER, ASSURANCE, BANQUE, …).<br/>
                    Il sert au mapping Nature ↔ Types et au filtrage des catégories dans la modal Transaction.
                  </p>
                  {errors.type && (
                    <p className="text-red-500 text-sm mt-1">{errors.type}</p>
                  )}
                </div>
              )}

              {/* Checkboxes pour catégories */}
              {mode === 'category' && (
                <div className="border-t pt-4 space-y-3">
                  <Label className="text-sm font-semibold text-gray-700">
                    Propriétés fiscales
                  </Label>
                  
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="deductible"
                      checked={formData.deductible}
                      onCheckedChange={(checked) => handleInputChange('deductible', checked)}
                    />
                    <div>
                      <label htmlFor="deductible" className="text-sm font-medium cursor-pointer">
                        Charge déductible
                      </label>
                      <p className="text-xs text-gray-500">
                        Cette catégorie représente une charge déductible des revenus fonciers/BIC
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="capitalizable"
                      checked={formData.capitalizable}
                      onCheckedChange={(checked) => handleInputChange('capitalizable', checked)}
                    />
                    <div>
                      <label htmlFor="capitalizable" className="text-sm font-medium cursor-pointer">
                        Charge capitalisable
                      </label>
                      <p className="text-xs text-gray-500">
                        Cette catégorie représente une charge à capitaliser (travaux d'amélioration, etc.)
                      </p>
                    </div>
                  </div>
                  
                  {formData.deductible && formData.capitalizable && (
                    <div className="bg-amber-50 border border-amber-200 rounded p-3">
                      <p className="text-xs text-amber-800">
                        ⚠️ Une charge ne peut pas être à la fois déductible ET capitalisable. 
                        Choisissez l'un ou l'autre.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => handleInputChange('active', checked)}
                />
                <label htmlFor="active" className="text-sm font-medium">
                  Actif
                </label>
              </div>
            </div>
          )}

          {activeTab === 'mapping' && mode === 'nature' && (
            <div className="space-y-6">
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Types de catégories compatibles *
                </Label>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-3">
                  {categoryTypes.map(type => (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox
                        id={`type-${type}`}
                        checked={formData.compatibleTypes.includes(type)}
                        onCheckedChange={() => handleCompatibleTypeToggle(type)}
                      />
                      <label htmlFor={`type-${type}`} className="text-sm">
                        {type}
                      </label>
                    </div>
                  ))}
                </div>
                {formData.compatibleTypes.length === 0 && (
                  <p className="text-sm text-amber-600 mt-2">
                    ⚠️ Au moins un type doit être sélectionné
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="defaultCategory" className="text-sm font-medium text-gray-700">
                  Catégorie par défaut
                </Label>
                <Select 
                  value={formData.defaultCategory} 
                  onValueChange={(value) => handleInputChange('defaultCategory', value)}
                  disabled={formData.compatibleTypes.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      formData.compatibleTypes.length === 0 
                        ? 'Sélectionnez d\'abord des types compatibles'
                        : 'Sélectionner une catégorie par défaut'
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Aucune catégorie par défaut</SelectItem>
                    {filteredCategories.map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.compatibleTypes.length > 0 && filteredCategories.length === 0 && (
                  <p className="text-sm text-amber-600 mt-2 flex items-center gap-1">
                    ⚠️ Aucune catégorie disponible pour les types sélectionnés
                  </p>
                )}
                {filteredCategories.length > 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    {filteredCategories.length} catégorie{filteredCategories.length > 1 ? 's' : ''} compatible{filteredCategories.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Aperçu JSON</CardTitle>
                  <CardDescription>
                    Voici le JSON qui sera exporté pour cet élément
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="bg-gray-100 p-4 rounded-md text-sm overflow-x-auto">
                    {JSON.stringify(generateJsonPreview(), null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="flex justify-end gap-3 mt-8 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Enregistrement...' : (item ? 'Modifier' : 'Créer')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
