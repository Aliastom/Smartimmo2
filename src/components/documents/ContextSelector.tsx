/**
 * Composant de sélection du contexte de rattachement d'un document
 * Permet de choisir entre GLOBAL, PROPERTY, LEASE, TENANT, TRANSACTION
 */

import { useState, useEffect } from 'react';
import { DocumentContext, DocumentContextType } from '@/types/document-link';
import { Label } from '@/ui/shared/label';
import { Select } from '@/ui/shared/select';
import { Building2, FileText, Users, Receipt, Globe } from 'lucide-react';

interface ContextSelectorProps {
  value: DocumentContext;
  onChange: (context: DocumentContext) => void;
  disabled?: boolean;
  hideSelector?: boolean; // Pour masquer le sélecteur quand pré-sélectionné
}

interface EntityOption {
  id: string;
  label: string;
}

export function ContextSelector({
  value,
  onChange,
  disabled = false,
  hideSelector = false,
}: ContextSelectorProps) {
  const [entityOptions, setEntityOptions] = useState<EntityOption[]>([]);
  const [isLoadingEntities, setIsLoadingEntities] = useState(false);

  // Icônes par type de contexte
  const contextIcons = {
    GLOBAL: Globe,
    PROPERTY: Building2,
    LEASE: FileText,
    TENANT: Users,
    TRANSACTION: Receipt,
  };

  const contextLabels = {
    GLOBAL: 'Global',
    PROPERTY: 'Bien immobilier',
    LEASE: 'Bail',
    TENANT: 'Locataire',
    TRANSACTION: 'Transaction',
  };

  // Charger les entités disponibles selon le type
  useEffect(() => {
    if (value.entityType === 'GLOBAL') {
      setEntityOptions([]);
      return;
    }

    loadEntities(value.entityType);
  }, [value.entityType]);

  const loadEntities = async (entityType: DocumentContextType) => {
    if (entityType === 'GLOBAL') return;

    setIsLoadingEntities(true);
    
    try {
      let endpoint = '';
      switch (entityType) {
        case 'PROPERTY':
          endpoint = '/api/properties';
          break;
        case 'LEASE':
          endpoint = '/api/leases';
          break;
        case 'TENANT':
          endpoint = '/api/tenants';
          break;
        case 'TRANSACTION':
          endpoint = '/api/transactions';
          break;
      }

      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Erreur de chargement');

      const data = await response.json();
      
      // Adapter selon la structure de réponse
      let options: EntityOption[] = [];
      
      if (entityType === 'PROPERTY') {
        options = data.map((item: any) => ({
          id: item.id,
          label: item.name || item.address || `Bien ${item.id}`,
        }));
      } else if (entityType === 'LEASE') {
        options = data.map((item: any) => ({
          id: item.id,
          label: item.Property?.name || `Bail ${item.id}`,
        }));
      } else if (entityType === 'TENANT') {
        options = data.map((item: any) => ({
          id: item.id,
          label: `${item.firstName} ${item.lastName}`,
        }));
      } else if (entityType === 'TRANSACTION') {
        options = data.map((item: any) => ({
          id: item.id,
          label: item.label || `Transaction ${item.id}`,
        }));
      }

      setEntityOptions(options);
    } catch (error) {
      console.error('Erreur de chargement des entités:', error);
      setEntityOptions([]);
    } finally {
      setIsLoadingEntities(false);
    }
  };

  const handleEntityTypeChange = (newType: string) => {
    const entityType = newType as DocumentContextType;
    onChange({
      entityType,
      entityId: entityType === 'GLOBAL' ? undefined : undefined,
    });
  };

  const handleEntityIdChange = (newId: string) => {
    onChange({
      ...value,
      entityId: newId,
    });
  };

  if (hideSelector) {
    // Afficher juste un badge indiquant le contexte sélectionné
    const Icon = contextIcons[value.entityType];
    return (
      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
        <Icon className="h-4 w-4 text-blue-600" />
        <div className="text-sm">
          <span className="font-medium text-blue-900">
            {contextLabels[value.entityType]}
          </span>
          {value.entityId && entityOptions.length > 0 && (
            <span className="text-blue-600 ml-2">
              • {entityOptions.find(e => e.id === value.entityId)?.label}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="entity-type">Rattachement du document</Label>
        <select
          id="entity-type"
          value={value.entityType}
          onChange={(e) => handleEntityTypeChange(e.target.value)}
          disabled={disabled}
          className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
        >
          <option value="GLOBAL">Global (visible partout)</option>
          <option value="PROPERTY">Bien immobilier</option>
          <option value="LEASE">Bail</option>
          <option value="TENANT">Locataire</option>
          <option value="TRANSACTION">Transaction</option>
        </select>
      </div>

      {value.entityType !== 'GLOBAL' && (
        <div>
          <Label htmlFor="entity-id">
            Sélectionner {contextLabels[value.entityType].toLowerCase()}
          </Label>
          {isLoadingEntities ? (
            <div className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">
              Chargement...
            </div>
          ) : entityOptions.length === 0 ? (
            <div className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">
              Aucun {contextLabels[value.entityType].toLowerCase()} disponible
            </div>
          ) : (
            <select
              id="entity-id"
              value={value.entityId || ''}
              onChange={(e) => handleEntityIdChange(e.target.value)}
              disabled={disabled}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="">-- Sélectionner --</option>
              {entityOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
          
          {value.entityType !== 'GLOBAL' && !value.entityId && (
            <p className="mt-1 text-xs text-amber-600">
              Veuillez sélectionner un {contextLabels[value.entityType].toLowerCase()} pour continuer
            </p>
          )}
        </div>
      )}
    </div>
  );
}

