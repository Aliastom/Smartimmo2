'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { LeaseManifestField } from '../../pdf/lease.manifest';
import { LeaseData } from '../../pdf/gapChecker';

interface LeaseCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (completedData: any) => void;
  missingFields: LeaseManifestField[];
  currentData: LeaseData;
}

export default function LeaseCompletionModal({
  isOpen,
  onClose,
  onComplete,
  missingFields,
  currentData,
}: LeaseCompletionModalProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (isOpen) {
      // Pré-remplir avec les données existantes
      const initialData: Record<string, any> = {};
      missingFields.forEach(field => {
        const value = getNestedValue(currentData, field.path);
        initialData[field.path] = value || field.defaultValue || '';
      });
      setFormData(initialData);
    }
  }, [isOpen, missingFields, currentData]);

  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };

  const handleChange = (path: string, value: any) => {
    setFormData(prev => ({ ...prev, [path]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Nettoyer et convertir les données
    const cleanedFormData: Record<string, any> = {};
    Object.keys(formData).forEach(path => {
      let value = formData[path];
      
      // Trim les strings
      if (typeof value === 'string') {
        value = value.trim();
        // Convertir chaînes vides en null
        if (value === '') {
          value = null;
        }
      }
      
      // Convertir les nombres depuis les strings
      if (value !== null && value !== '' && typeof value === 'string') {
        if (path.includes('Amount') || path.includes('surface') || path.includes('rooms') || path.includes('Day') || path.includes('Months')) {
          const parsed = path.includes('Amount') || path.includes('surface') 
            ? parseFloat(value) 
            : parseInt(value, 10);
          if (!isNaN(parsed)) {
            value = parsed;
          }
        }
      }
      
      cleanedFormData[path] = value;
    });

    // Vérifier que tous les champs requis sont remplis
    const stillMissing = missingFields.filter(field => {
      if (!field.required) return false;
      const value = cleanedFormData[field.path];
      // Accepter 0 comme valeur valide
      if (value === 0) return false;
      return value === null || value === undefined || value === '';
    });

    if (stillMissing.length > 0) {
      alert(`Veuillez remplir tous les champs obligatoires`);
      return;
    }

    // Construire l'objet de complétion
    const completionData: Record<string, any> = {};
    Object.keys(cleanedFormData).forEach(path => {
      setNestedValue(completionData, path, cleanedFormData[path]);
    });

    onComplete(completionData);
  };

  const setNestedValue = (obj: any, path: string, value: any): void => {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  };

  if (!isOpen) return null;

  // Grouper les champs par objet (landlord, tenant, property, lease)
  const groupedFields = missingFields.reduce((acc, field) => {
    const group = field.path.split('.')[0];
    if (!acc[group]) acc[group] = [];
    acc[group].push(field);
    return acc;
  }, {} as Record<string, LeaseManifestField[]>);

  const groupLabels: Record<string, string> = {
    landlord: 'Informations du bailleur',
    tenant: 'Informations du locataire',
    property: 'Informations du bien',
    lease: 'Informations du bail',
  };

  return (
    <div className="fixed inset-0 bg-base-content/50 flex items-center justify-center z-50 p-4">
      <div className="bg-base-100 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">
              Compléter les informations manquantes
            </h2>
            <p className="text-sm text-neutral-600 mt-1">
              Certaines informations sont nécessaires pour générer le bail
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 transition"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="p-6 space-y-6">
            {Object.entries(groupedFields).map(([group, fields]) => (
              <div key={group} className="space-y-4">
                <h3 className="text-lg font-medium text-neutral-900 border-b pb-2">
                  {groupLabels[group]}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {fields.map(field => (
                    <div key={field.path} className={field.path.includes('address') ? 'md:col-span-2' : ''}>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        {field.label}
                        {field.required && <span className="text-error ml-1">*</span>}
                      </label>
                      {renderInput(field, formData[field.path], (value) => handleChange(field.path, value))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-200 bg-neutral-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-neutral-700 bg-base-100 border border-neutral-300 rounded-md hover:bg-neutral-50 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-base-100 bg-primary rounded-md hover:bg-primary transition"
            >
              Générer le bail
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function renderInput(
  field: LeaseManifestField,
  value: any,
  onChange: (value: any) => void
): React.ReactNode {
  // Déterminer le type d'input selon le champ
  if (field.path.includes('Date')) {
    return (
      <input
        type="date"
        value={value instanceof Date ? value.toISOString().split('T')[0] : value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
        required={field.required}
      />
    );
  }

  if (field.path.includes('email') || field.path.includes('Email')) {
    return (
      <input
        type="email"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
        required={field.required}
      />
    );
  }

  if (field.path.includes('phone') || field.path.includes('Phone')) {
    return (
      <input
        type="tel"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
        required={field.required}
      />
    );
  }

  if (field.path.includes('Amount') || field.path.includes('surface') || field.path.includes('rooms') || field.path.includes('Day')) {
    return (
      <input
        type="number"
        step={field.path.includes('Amount') ? '0.01' : '1'}
        value={value || ''}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
        required={field.required}
      />
    );
  }

  if (field.path === 'lease.indexationType') {
    return (
      <select
        value={value || 'IRL'}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
        required={field.required}
      >
        <option value="IRL">IRL (Indice de Référence des Loyers)</option>
        <option value="ICC">ICC (Indice du Coût de la Construction)</option>
        <option value="ILAT">ILAT (Indice des Loyers des Activités Tertiaires)</option>
        <option value="none">Aucune</option>
      </select>
    );
  }

  return (
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
      required={field.required}
    />
  );
}

