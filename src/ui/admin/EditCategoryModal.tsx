'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface EditCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedCategory: any) => void;
  Category: {
    id: string;
    label: string;
    type: string;
    deductible: boolean;
    capitalizable: boolean;
    actif: boolean;
  } | null;
  allowedTypes: string[];
  currentNature: string;
}

export default function EditCategoryModal({
  isOpen,
  onClose,
  onSuccess,
  category,
  allowedTypes,
  currentNature
}: EditCategoryModalProps) {
  const [formData, setFormData] = useState({
    label: '',
    type: 'REVENU',
    deductible: false,
    capitalizable: false,
    actif: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialiser le formulaire avec les données de la catégorie
  useEffect(() => {
    if (category) {
      setFormData({
        label: category.label,
        type: category.type,
        deductible: category.deductible,
        capitalizable: category.capitalizable,
        actif: category.actif
      });
    }
  }, [category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) return;

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/categories/${category.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la modification de la catégorie');
      }

      const result = await response.json();
      
      // Afficher les avertissements s'il y en a
      if (result.warnings && result.warnings.length > 0) {
        result.warnings.forEach((warning: string) => {
          toast.warning('Avertissement', { description: warning });
        });
      }

      toast.success('Catégorie modifiée avec succès !', {
        description: `"${result.Category.label}" a été mise à jour.`,
      });

      onSuccess(result.Category);
      onClose();
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const isTypeCompatible = allowedTypes.includes(formData.type);
  const hasChanges = category && (
    formData.label !== category.label ||
    formData.type !== category.type ||
    formData.deductible !== category.deductible ||
    formData.capitalizable !== category.capitalizable ||
    formData.actif !== category.actif
  );

  if (!isOpen || !category) return null;

  return (
    <div className="fixed inset-0 bg-base-content bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-base-100 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-lg font-semibold text-neutral-900">
            Modifier la catégorie
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Nom de la catégorie *
            </label>
            <input
              type="text"
              value={formData.label}
              onChange={(e) => handleInputChange('label', e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-primary"
              placeholder="Ex: Loyer, Charges locatives..."
              required
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Type *
            </label>
            <select
              value={formData.type}
              onChange={(e) => handleInputChange('type', e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-primary"
              required
            >
              <option value="REVENU">Revenu</option>
              <option value="DEPENSE">Dépense</option>
              <option value="NON_DEFINI">Non défini</option>
            </select>
            
            {/* Alerte de compatibilité */}
            {!isTypeCompatible && (
              <div className="mt-2 flex items-center text-sm text-amber-600 bg-amber-50 p-2 rounded-md">
                <AlertTriangle className="h-4 w-4 mr-2" />
                <span>
                  Ce type n'est pas autorisé pour la nature "{currentNature}". 
                  La catégorie par défaut sera supprimée pour cette nature.
                </span>
              </div>
            )}
          </div>

          {/* Deductible */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="deductible"
              checked={formData.deductible}
              onChange={(e) => handleInputChange('deductible', e.target.checked)}
              className="h-4 w-4 text-primary focus:ring-blue-500 border-neutral-300 rounded"
            />
            <label htmlFor="deductible" className="ml-2 text-sm text-neutral-700">
              Déductible fiscalement
            </label>
          </div>

          {/* Capitalizable */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="capitalizable"
              checked={formData.capitalizable}
              onChange={(e) => handleInputChange('capitalizable', e.target.checked)}
              className="h-4 w-4 text-primary focus:ring-blue-500 border-neutral-300 rounded"
            />
            <label htmlFor="capitalizable" className="ml-2 text-sm text-neutral-700">
              Capitalisable
            </label>
          </div>

          {/* Actif */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="actif"
              checked={formData.actif}
              onChange={(e) => handleInputChange('actif', e.target.checked)}
              className="h-4 w-4 text-primary focus:ring-blue-500 border-neutral-300 rounded"
            />
            <label htmlFor="actif" className="ml-2 text-sm text-neutral-700">
              Active
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-neutral-700 bg-base-100 border border-neutral-300 rounded-md hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.label.trim() || !hasChanges}
              className="px-4 py-2 text-sm font-medium text-base-100 bg-primary border border-transparent rounded-md hover:bg-primary focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Modification...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Enregistrer
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
