'use client';

import React, { useState } from 'react';
import { Search, Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

interface LeasesFiltersProps {
  filters: {
    search: string;
    propertyId: string;
    tenantId: string;
    type: string;
    furnishedType: string;
    status: string;
    startDateFrom: string;
    startDateTo: string;
    endDateFrom: string;
    endDateTo: string;
    indexationType: string;
    indexationDateFrom: string;
    indexationDateTo: string;
    rentMin: string;
    rentMax: string;
    depositMin: string;
    depositMax: string;
  };
  onFiltersChange: (filters: any) => void;
  onResetFilters: () => void;
  properties: any[];
  tenants: any[];
  // Masquer le filtre Bien (pour l'onglet bien)
  hidePropertyFilter?: boolean;
}

const TYPE_OPTIONS = [
  { value: '', label: 'Tous les types' },
  { value: 'RESIDENTIEL', label: 'Résidentiel' },
  { value: 'COMMERCIAL', label: 'Commercial' },
  { value: 'SAISONNIER', label: 'Saisonnier' },
  { value: 'GARAGE', label: 'Garage/Parking' },
];

const FURNISHED_TYPE_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'VIDE', label: 'Vide' },
  { value: 'MEUBLE', label: 'Meublé' },
  { value: 'COLOCATION_MEUBLEE', label: 'Colocation meublée' },
  { value: 'COLOCATION_VIDE', label: 'Colocation vide' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'BROUILLON', label: 'Brouillon' },
  { value: 'ENVOYE', label: 'Envoyé' },
  { value: 'SIGNE', label: 'Signé' },
  { value: 'ACTIF', label: 'Actif' },
  { value: 'RESILIE', label: 'Résilié' },
];

const INDEXATION_TYPE_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'AUCUNE', label: 'Aucune' },
  { value: 'IRL', label: 'IRL' },
  { value: 'ILAT', label: 'ILAT' },
  { value: 'ICC', label: 'ICC' },
  { value: 'AUTRE', label: 'Autre' },
];

export default function LeasesFilters({
  filters,
  onFiltersChange,
  onResetFilters,
  properties,
  tenants,
  hidePropertyFilter = false
}: LeasesFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleFilterChange = (key: string, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  // Compter les filtres actifs
  const countActiveFilters = () => {
    return Object.values(filters).filter(v => v !== '' && v !== null && v !== undefined).length;
  };
  
  const activeFiltersCount = countActiveFilters();
  const hasActiveFilters = activeFiltersCount > 0;

  return (
    <Card className="w-full">
      {/* Header avec bouton toggle */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-gray-900">Filtres</h3>
          {hasActiveFilters && (
            <span className="bg-blue-100 text-blue-600 text-xs font-medium px-2 py-1 rounded-full">
              {activeFiltersCount} actif{activeFiltersCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Filter className="h-4 w-4 mr-2" />
          {isExpanded ? 'Masquer' : 'Afficher'}
        </Button>
      </div>

      {/* Contenu */}
      <div className="px-6 py-3">
        {/* Recherche - TOUJOURS VISIBLE */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Rechercher par locataire, bien, référence…"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-9"
            />
          </div>
          {filters.search && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleFilterChange('search', '')}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Séparateur */}
        {isExpanded && <div className="border-t border-gray-200 my-4" />}

        {/* Filtres détaillés (repliables) */}
        {isExpanded && (
          <div className="space-y-6">

            {/* Ligne 2: Bien, Locataire, Type de bail */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
              {!hidePropertyFilter && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bien
                  </label>
                  <select
                    value={filters.propertyId}
                    onChange={(e) => handleFilterChange('propertyId', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                  >
                    <option value="">Tous les biens</option>
                    {Array.isArray(properties) && properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Locataire
                </label>
                <select
                  value={filters.tenantId}
                  onChange={(e) => handleFilterChange('tenantId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                >
                  <option value="">Tous les locataires</option>
                  {Array.isArray(tenants) && tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.firstName} {tenant.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type de bail
                </label>
                <select
                  value={filters.type}
                  onChange={(e) => handleFilterChange('type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                >
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Ligne 3: Type de meublé, Statut workflow */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type de meublé
                </label>
                <select
                  value={filters.furnishedType}
                  onChange={(e) => handleFilterChange('furnishedType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                >
                  {FURNISHED_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Statut workflow
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Ligne 4: Dates de début */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de début (de)
                </label>
                <Input
                  type="date"
                  value={filters.startDateFrom}
                  onChange={(e) => handleFilterChange('startDateFrom', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de début (à)
                </label>
                <Input
                  type="date"
                  value={filters.startDateTo}
                  onChange={(e) => handleFilterChange('startDateTo', e.target.value)}
                />
              </div>
            </div>

            {/* Ligne 5: Dates de fin */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de fin (de)
                </label>
                <Input
                  type="date"
                  value={filters.endDateFrom}
                  onChange={(e) => handleFilterChange('endDateFrom', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de fin (à)
                </label>
                <Input
                  type="date"
                  value={filters.endDateTo}
                  onChange={(e) => handleFilterChange('endDateTo', e.target.value)}
                />
              </div>
            </div>

            {/* Ligne 6: Indexation */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type d'indexation
                </label>
                <select
                  value={filters.indexationType}
                  onChange={(e) => handleFilterChange('indexationType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                >
                  {INDEXATION_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prochaine indexation (de)
                </label>
                <Input
                  type="date"
                  value={filters.indexationDateFrom}
                  onChange={(e) => handleFilterChange('indexationDateFrom', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prochaine indexation (à)
                </label>
                <Input
                  type="date"
                  value={filters.indexationDateTo}
                  onChange={(e) => handleFilterChange('indexationDateTo', e.target.value)}
                />
              </div>
            </div>

            {/* Ligne 7: Montants */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Loyer min (€)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={filters.rentMin}
                  onChange={(e) => handleFilterChange('rentMin', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Loyer max (€)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="∞"
                  value={filters.rentMax}
                  onChange={(e) => handleFilterChange('rentMax', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Caution min (€)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={filters.depositMin}
                  onChange={(e) => handleFilterChange('depositMin', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Caution max (€)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="∞"
                  value={filters.depositMax}
                  onChange={(e) => handleFilterChange('depositMax', e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Bouton Réinitialiser en bas si filtres actifs */}
        {isExpanded && hasActiveFilters && (
          <div className="pt-4 border-t border-gray-200">
            <Button
              variant="outline"
              size="sm"
              onClick={onResetFilters}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300"
            >
              <X className="h-4 w-4 mr-1" />
              Réinitialiser tous les filtres
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

