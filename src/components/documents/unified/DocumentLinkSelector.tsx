'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Search, Building2, FileText, CreditCard, Users, Globe } from 'lucide-react';

interface DocumentLinkSelectorProps {
  currentLinkedTo?: 'global' | 'property' | 'lease' | 'transaction' | 'loan' | 'tenant';
  currentLinkedId?: string;
  onSelect: (linkedTo: 'global' | 'property' | 'lease' | 'transaction' | 'loan' | 'tenant', linkedId?: string) => void;
  onCancel?: () => void;
}

export function DocumentLinkSelector({
  currentLinkedTo = 'global',
  currentLinkedId,
  onSelect,
  onCancel,
}: DocumentLinkSelectorProps) {
  const [selectedType, setSelectedType] = useState<'global' | 'property' | 'lease' | 'transaction' | 'loan' | 'tenant'>(currentLinkedTo);
  const [searchQuery, setSearchQuery] = useState('');
  const [entities, setEntities] = useState<any[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | undefined>(currentLinkedId);
  const [loading, setLoading] = useState(false);

  const linkTypes = [
    { value: 'global', label: 'Global', icon: Globe },
    { value: 'property', label: 'Bien', icon: Building2 },
    { value: 'lease', label: 'Bail', icon: FileText },
    { value: 'transaction', label: 'Transaction', icon: CreditCard },
    { value: 'tenant', label: 'Locataire', icon: Users },
  ];

  useEffect(() => {
    if (selectedType !== 'global') {
      loadEntities();
    } else {
      setEntities([]);
      setSelectedEntityId(undefined);
    }
  }, [selectedType, searchQuery]);

  const loadEntities = async () => {
    setLoading(true);
    try {
      let endpoint = '';
      switch (selectedType) {
        case 'property':
          endpoint = '/api/properties';
          break;
        case 'lease':
          endpoint = '/api/leases';
          break;
        case 'transaction':
          endpoint = '/api/transactions';
          break;
        case 'tenant':
          endpoint = '/api/tenants';
          break;
      }

      if (endpoint) {
        const params = new URLSearchParams();
        if (searchQuery) params.append('search', searchQuery);
        params.append('limit', '20');

        const response = await fetch(`${endpoint}?${params.toString()}`);
        const data = await response.json();

        // Adapter selon le format de réponse
        if (data.data) {
          setEntities(data.data);
        } else if (Array.isArray(data)) {
          setEntities(data);
        } else {
          setEntities([]);
        }
      }
    } catch (error) {
      console.error('Error loading entities:', error);
      setEntities([]);
    } finally {
      setLoading(false);
    }
  };

  const getEntityLabel = (entity: any) => {
    switch (selectedType) {
      case 'property':
        return `${entity.name} - ${entity.address}`;
      case 'lease':
        return `Bail ${entity.Property?.name || ''} - ${entity.Tenant?.firstName} ${entity.Tenant?.lastName}`;
      case 'transaction':
        return `${entity.label} - ${entity.amount}€`;
      case 'tenant':
        return `${entity.firstName} ${entity.lastName}`;
      default:
        return entity.id;
    }
  };

  const handleSubmit = () => {
    if (selectedType === 'global') {
      onSelect('global');
    } else if (selectedEntityId) {
      onSelect(selectedType, selectedEntityId);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Type de liaison
        </label>
        <div className="flex flex-wrap gap-2">
          {linkTypes.map((type) => {
            const Icon = type.icon;
            return (
              <Button
                key={type.value}
                variant={selectedType === type.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType(type.value as any)}
              >
                <Icon className="h-4 w-4 mr-2" />
                {type.label}
              </Button>
            );
          })}
        </div>
      </div>

      {selectedType !== 'global' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rechercher un {linkTypes.find(t => t.value === selectedType)?.label.toLowerCase()}
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sélectionner
            </label>
            <div className="border border-gray-300 rounded-lg max-h-64 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-500">Chargement...</div>
              ) : entities.length === 0 ? (
                <div className="p-4 text-center text-gray-500">Aucun résultat</div>
              ) : (
                <div className="divide-y">
                  {entities.map((entity) => (
                    <div
                      key={entity.id}
                      className={`
                        p-3 cursor-pointer hover:bg-gray-50 transition-colors
                        ${selectedEntityId === entity.id ? 'bg-primary-50' : ''}
                      `}
                      onClick={() => setSelectedEntityId(entity.id)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{getEntityLabel(entity)}</span>
                        {selectedEntityId === entity.id && (
                          <Badge variant="default" className="text-xs">Sélectionné</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div className="flex gap-2 pt-4 border-t">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Annuler
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={selectedType !== 'global' && !selectedEntityId}
        >
          Valider
        </Button>
      </div>
    </div>
  );
}

