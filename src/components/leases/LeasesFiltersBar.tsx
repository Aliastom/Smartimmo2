'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Search, Filter, X, RotateCcw, Calendar, Euro, FileText } from 'lucide-react';

export interface LeaseFilters {
  search?: string;
  status?: string[];
  type?: string[];
  propertyId?: string;
  tenantId?: string;
  upcomingExpiration?: boolean;
  missingDocuments?: boolean;
  indexationDue?: boolean;
  rentMin?: number;
  rentMax?: number;
  periodStart?: string;
  periodEnd?: string;
}

interface LeasesFiltersBarProps {
  filters: LeaseFilters;
  onFiltersChange: (filters: LeaseFilters) => void;
  onReset: () => void;
  loading?: boolean;
}

const STATUS_OPTIONS = [
  { value: 'BROUILLON', label: 'Brouillon' },
  { value: 'ENVOYÉ', label: 'Envoyé' },
  { value: 'SIGNÉ', label: 'Signé' },
  { value: 'ACTIF', label: 'Actif' },
  { value: 'RÉSILIÉ', label: 'Résilié' }
];

const TYPE_OPTIONS = [
  { value: 'residential', label: 'Résidentiel' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'garage', label: 'Garage' }
];

export function LeasesFiltersBar({ filters, onFiltersChange, onReset, loading = false }: LeasesFiltersBarProps) {
  const [localFilters, setLocalFilters] = useState<LeaseFilters>(filters);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleFilterChange = (key: keyof LeaseFilters, value: any) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleStatusToggle = (status: string) => {
    const currentStatuses = localFilters.status || [];
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter(s => s !== status)
      : [...currentStatuses, status];
    handleFilterChange('status', newStatuses);
  };

  const handleTypeToggle = (type: string) => {
    const currentTypes = localFilters.type || [];
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter(t => t !== type)
      : [...currentTypes, type];
    handleFilterChange('type', newTypes);
  };

  const handleQuickFilterToggle = (key: keyof LeaseFilters) => {
    const currentValue = localFilters[key];
    handleFilterChange(key, !currentValue);
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (localFilters.search) count++;
    if (localFilters.status && localFilters.status.length > 0) count++;
    if (localFilters.type && localFilters.type.length > 0) count++;
    if (localFilters.upcomingExpiration) count++;
    if (localFilters.missingDocuments) count++;
    if (localFilters.indexationDue) count++;
    if (localFilters.rentMin || localFilters.rentMax) count++;
    if (localFilters.periodStart || localFilters.periodEnd) count++;
    return count;
  };

  const activeFiltersCount = getActiveFiltersCount();

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filtres
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeFiltersCount}
            </Badge>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? 'Masquer' : 'Avancé'}
          </Button>
          {activeFiltersCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              disabled={loading}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Réinitialiser
            </Button>
          )}
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par bien, adresse, locataire..."
            value={localFilters.search || ''}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={loading}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={localFilters.upcomingExpiration ? "default" : "outline"}
            size="sm"
            onClick={() => handleQuickFilterToggle('upcomingExpiration')}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            Expirant &lt; 90j
          </Button>
          <Button
            variant={localFilters.missingDocuments ? "default" : "outline"}
            size="sm"
            onClick={() => handleQuickFilterToggle('missingDocuments')}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Sans bail signé
          </Button>
          <Button
            variant={localFilters.indexationDue ? "default" : "outline"}
            size="sm"
            onClick={() => handleQuickFilterToggle('indexationDue')}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <Euro className="h-4 w-4" />
            Indexation due
          </Button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Statut
          </label>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((status) => {
              const isActive = localFilters.status?.includes(status.value);
              return (
                <Button
                  key={status.value}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleStatusToggle(status.value)}
                  disabled={loading}
                >
                  {status.label}
                </Button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type de bail
          </label>
          <div className="flex flex-wrap gap-2">
            {TYPE_OPTIONS.map((type) => {
              const isActive = localFilters.type?.includes(type.value);
              return (
                <Button
                  key={type.value}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleTypeToggle(type.value)}
                  disabled={loading}
                >
                  {type.label}
                </Button>
              );
            })}
          </div>
        </div>

        {showAdvanced && (
          <div className="border-t pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Montant du loyer (€)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={localFilters.rentMin || ''}
                    onChange={(e) => handleFilterChange('rentMin', e.target.value ? Number(e.target.value) : undefined)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={loading}
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={localFilters.rentMax || ''}
                    onChange={(e) => handleFilterChange('rentMax', e.target.value ? Number(e.target.value) : undefined)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Période
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={localFilters.periodStart || ''}
                    onChange={(e) => handleFilterChange('periodStart', e.target.value || undefined)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={loading}
                  />
                  <input
                    type="date"
                    value={localFilters.periodEnd || ''}
                    onChange={(e) => handleFilterChange('periodEnd', e.target.value || undefined)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeFiltersCount > 0 && (
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-gray-700">Filtres actifs :</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {localFilters.search && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Recherche: {localFilters.search}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => handleFilterChange('search', undefined)}
                  />
                </Badge>
              )}
              {localFilters.status && localFilters.status.length > 0 && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Statut: {localFilters.status.join(', ')}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => handleFilterChange('status', [])}
                  />
                </Badge>
              )}
              {localFilters.type && localFilters.type.length > 0 && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Type: {localFilters.type.join(', ')}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => handleFilterChange('type', [])}
                  />
                </Badge>
              )}
              {localFilters.upcomingExpiration && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Expirant &lt; 90j
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => handleFilterChange('upcomingExpiration', false)}
                  />
                </Badge>
              )}
              {localFilters.missingDocuments && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Sans bail signé
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => handleFilterChange('missingDocuments', false)}
                  />
                </Badge>
              )}
              {localFilters.indexationDue && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Indexation due
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => handleFilterChange('indexationDue', false)}
                  />
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}