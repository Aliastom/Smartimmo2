'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify2 } from '@/lib/notify2';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Save, RefreshCw, BookOpen } from 'lucide-react';
import { NatureCombobox } from '@/components/gestion/NatureCombobox';
import { CategoryCombobox } from '@/components/gestion/CategoryCombobox';
import { GestionDelegueHelpModal } from '@/components/gestion/GestionDelegueHelpModal';

interface Settings {
  'gestion.enable': boolean;
  'gestion.codes.rent.nature': string;
  'gestion.codes.rent.Category': string;
  'gestion.codes.mgmt.nature': string;
  'gestion.codes.mgmt.Category': string;
  'gestion.defaults.baseSurEncaissement': boolean;
  'gestion.defaults.tvaApplicable': boolean;
  'gestion.defaults.tvaTaux': number;
}

export default function GestionDelegueePage() {
  const queryClient = useQueryClient();
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Charger les settings
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'gestion'],
    queryFn: async () => {
      const response = await fetch('/api/settings?prefix=gestion.');
      if (!response.ok) throw new Error('Erreur lors du chargement des paramètres');
      return response.json();
    },
  });

  // État local du formulaire
  const [formData, setFormData] = useState<Settings>({
    'gestion.enable': false,
    'gestion.codes.rent.nature': 'RECETTE_LOYER',
    'gestion.codes.rent.Category': 'loyer_principal',
    'gestion.codes.mgmt.nature': 'DEPENSE_GESTION',
    'gestion.codes.mgmt.Category': 'frais_gestion',
    'gestion.defaults.baseSurEncaissement': true,
    'gestion.defaults.tvaApplicable': false,
    'gestion.defaults.tvaTaux': 20,
  });

  // Initialiser le formulaire avec les données de l'API
  useEffect(() => {
    if (data?.settings) {
      setFormData((prev) => ({
        ...prev,
        ...data.settings,
      }));
    }
  }, [data]);

  // Mutation pour enregistrer un paramètre
  const saveMutation = useMutation({
    mutationFn: async (params: { key: string; value: unknown }) => {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        // Extraire le message d'erreur de validation si disponible
        const message = errorData.message || errorData.error || 'Erreur lors de la sauvegarde';
        throw new Error(message);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'gestion'] });
      notify2.success('Paramètres enregistrés avec succès');
    },
    onError: (error: any) => {
      console.error('Erreur:', error);
      notify2.error(error.message || 'Erreur lors de l\'enregistrement');
    },
  });

  const handleSave = async () => {
    try {
      // Enregistrer les paramètres dans un ordre spécifique pour éviter les erreurs de validation
      // 1. Activer/désactiver la fonctionnalité
      await saveMutation.mutateAsync({ 
        key: 'gestion.enable', 
        value: formData['gestion.enable'] 
      });
      
      // 2. Sauvegarder les natures d'abord
      await saveMutation.mutateAsync({
        key: 'gestion.codes.rent.nature',
        value: formData['gestion.codes.rent.nature']
      });
      await saveMutation.mutateAsync({
        key: 'gestion.codes.mgmt.nature',
        value: formData['gestion.codes.mgmt.nature']
      });
      
      // 3. Ensuite les catégories (qui dépendent des natures)
      if (formData['gestion.codes.rent.Category']) {
        await saveMutation.mutateAsync({
          key: 'gestion.codes.rent.Category',
          value: formData['gestion.codes.rent.Category']
        });
      }
      if (formData['gestion.codes.mgmt.Category']) {
        await saveMutation.mutateAsync({
          key: 'gestion.codes.mgmt.Category',
          value: formData['gestion.codes.mgmt.Category']
        });
      }
      
      // 4. Enfin les valeurs par défaut
      await saveMutation.mutateAsync({
        key: 'gestion.defaults.baseSurEncaissement',
        value: formData['gestion.defaults.baseSurEncaissement']
      });
      await saveMutation.mutateAsync({
        key: 'gestion.defaults.tvaApplicable',
        value: formData['gestion.defaults.tvaApplicable']
      });
      await saveMutation.mutateAsync({
        key: 'gestion.defaults.tvaTaux',
        value: formData['gestion.defaults.tvaTaux']
      });
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde:', error);
      // L'erreur est déjà affichée par la mutation
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-500 mb-4" />
          <p className="text-gray-600">Chargement des paramètres...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Paramètres - Gestion déléguée
          </h1>
          <p className="text-gray-600">
            Configurez les paramètres système pour la gestion des sociétés de gestion
          </p>
        </div>

        {/* Encart d'information */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-yellow-800">
                  Configuration de la gestion déléguée
                </h3>
                <button
                  onClick={() => setShowHelpModal(true)}
                  className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                >
                  <BookOpen className="h-4 w-4" />
                  Documentation complète
                </button>
              </div>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  La gestion déléguée permet de créer automatiquement des transactions de commission d'agence lorsqu'un loyer est encaissé. 
                  Configurez les codes système (natures et catégories) pour que le système reconnaisse les loyers et génère les commissions avec calcul automatique (base, taux, TVA).
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Bloc A : Activation */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Activation
            </h2>
            
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Activer la gestion déléguée
                </label>
                <p className="text-sm text-gray-500 mt-1">
                  Active ou désactive la fonctionnalité de gestion par des sociétés tierces
                </p>
              </div>
              <Switch
                checked={formData['gestion.enable']}
                onCheckedChange={(checked) => setFormData({ ...formData, 'gestion.enable': checked })}
              />
            </div>
          </div>

          {/* Bloc B : Codes système */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Codes système
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Ces codes déterminent quelles transactions déclenchent la création automatique de commissions
            </p>

            <div className="space-y-4">
              {/* Nature Loyer */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nature Loyer
                </label>
                <NatureCombobox
                  value={formData['gestion.codes.rent.nature']}
                  onChange={(code) => {
                    setFormData({ ...formData, 'gestion.codes.rent.nature': code });
                    // Réinitialiser la catégorie si la nature change
                    if (formData['gestion.codes.rent.Category']) {
                      setFormData(prev => ({ ...prev, 'gestion.codes.rent.Category': '' }));
                    }
                  }}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Nature utilisée pour reconnaître un loyer
                </p>
              </div>

              {/* Catégorie Loyer */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Catégorie Loyer
                </label>
                <CategoryCombobox
                  value={formData['gestion.codes.rent.Category']}
                  onChange={(code) => setFormData({ ...formData, 'gestion.codes.rent.Category': code })}
                  natureCode={formData['gestion.codes.rent.nature']}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Catégorie par défaut pour un loyer
                </p>
              </div>

              {/* Nature Frais de gestion */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nature Frais de gestion
                </label>
                <NatureCombobox
                  value={formData['gestion.codes.mgmt.nature']}
                  onChange={(code) => {
                    setFormData({ ...formData, 'gestion.codes.mgmt.nature': code });
                    // Réinitialiser la catégorie si la nature change
                    if (formData['gestion.codes.mgmt.Category']) {
                      setFormData(prev => ({ ...prev, 'gestion.codes.mgmt.Category': '' }));
                    }
                  }}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Nature utilisée pour créer une commission
                </p>
              </div>

              {/* Catégorie Frais de gestion */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Catégorie Frais de gestion
                </label>
                <CategoryCombobox
                  value={formData['gestion.codes.mgmt.Category']}
                  onChange={(code) => setFormData({ ...formData, 'gestion.codes.mgmt.Category': code })}
                  natureCode={formData['gestion.codes.mgmt.nature']}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Catégorie utilisée pour créer une commission
                </p>
              </div>
            </div>
          </div>

          {/* Bloc C : Valeurs préremplies pour les nouvelles sociétés */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Valeurs préremplies pour les nouvelles sociétés
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Ces paramètres sont utilisés uniquement comme valeurs initiales lors de la création d'une société de gestion. Chaque société possède ensuite ses propres réglages.
            </p>

            <div className="space-y-4">
              {/* Base sur encaissement */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Base sur encaissement
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Calculer la commission sur les montants encaissés (vs engagés)
                  </p>
                </div>
                <Switch
                  checked={formData['gestion.defaults.baseSurEncaissement']}
                  onCheckedChange={(checked) => setFormData({ ...formData, 'gestion.defaults.baseSurEncaissement': checked })}
                />
              </div>

              {/* TVA applicable */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    TVA applicable par défaut
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Appliquer la TVA sur les commissions par défaut
                  </p>
                </div>
                <Switch
                  checked={formData['gestion.defaults.tvaApplicable']}
                  onCheckedChange={(checked) => setFormData({ ...formData, 'gestion.defaults.tvaApplicable': checked })}
                />
              </div>

              {/* Taux TVA */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Taux TVA par défaut (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData['gestion.defaults.tvaTaux']}
                  onChange={(e) => setFormData({ ...formData, 'gestion.defaults.tvaTaux': parseFloat(e.target.value) || 20 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="20"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Taux de TVA appliqué si "TVA applicable" est coché
                </p>
              </div>
            </div>
          </div>

          {/* Bouton Enregistrer */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2"
            >
              {saveMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Enregistrer les paramètres
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Modal d'aide/documentation */}
        <GestionDelegueHelpModal 
          isOpen={showHelpModal} 
          onClose={() => setShowHelpModal(false)} 
        />
      </div>
    </div>
  );
}


