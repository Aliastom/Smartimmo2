'use client';

import React, { useId, useState } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { FormShellStandard, FormShellStandardFooter } from '@/components/ui/standards';

interface CreateCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newCategory: any) => void;
  allowedTypes: string[];
  currentNature: string;
}

export default function CreateCategoryModal({
  isOpen,
  onClose,
  onSuccess,
  allowedTypes,
  currentNature
}: CreateCategoryModalProps) {
  const formId = useId();
  const [formData, setFormData] = useState({
    label: '',
    type: allowedTypes[0] || 'REVENU',
    deductible: false,
    capitalizable: false,
    actif: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la création de la catégorie');
      }

      const newCategory = await response.json();
      
      toast.success('Catégorie créée avec succès !', {
        description: `"${newCategory.label}" a été ajoutée.`,
      });

      onSuccess(newCategory);
      onClose();
      
      // Reset form
      setFormData({
        label: '',
        type: allowedTypes[0] || 'REVENU',
        deductible: false,
        capitalizable: false,
        actif: true
      });
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-base-content bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-base-100 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-lg font-semibold text-neutral-900">
            Nouvelle catégorie
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <FormShellStandard id={formId} onSubmit={handleSubmit} className="p-6 space-y-4">
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
              {allowedTypes.map(type => (
                <option key={type} value={type}>
                  {type === 'REVENU' ? 'Revenu' : type === 'DEPENSE' ? 'Dépense' : 'Non défini'}
                </option>
              ))}
            </select>
            <p className="text-xs text-neutral-500 mt-1">
              Types autorisés pour la nature "{currentNature}"
            </p>
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
          <FormShellStandardFooter
            formId={formId}
            onCancel={onClose}
            className="pt-4"
            saveActionProps={{
              mode: 'create',
              isLoading: isSubmitting,
              disabled: isSubmitting || !formData.label.trim(),
              labelCreate: 'Créer',
              loadingLabel: 'Création...',
            }}
          />
        </FormShellStandard>
      </div>
    </div>
  );
}
