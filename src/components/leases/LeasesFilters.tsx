'use client';

import React, { useState } from 'react';
import { Search, Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { SmartSelect } from '@/components/ui/SmartSelect';
import { SmartDatePicker } from '@/components/ui/SmartDatePicker';

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
  { value: 'À_ENVOYER', label: 'À envoyer' },
  { value: 'A_ENVOYER', label: 'À envoyer' },
  { value: 'TO_SEND', label: 'À envoyer' },
  { value: 'ENVOYÉ', label: 'Envoyé' },
  { value: 'ENVOYE', label: 'Envoyé' },
  { value: 'SIGNÉ', label: 'Signé' },
  { value: 'SIGNE', label: 'Signé' },
  { value: 'ACTIF', label: 'Actif' },
  { value: 'RÉSILIÉ', label: 'Résilié' },
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
            <span className="bg-orange-100 text-orange-600 text-xs font-medium px-2 py-1 rounded-full">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="filter-propertyId">
                    Bien
                  </label>
                  <SmartSelect
                    id="filter-propertyId"
                    value={filters.propertyId}
                    onChange={(value) => handleFilterChange('propertyId', value)}
                    options={[
                      { value: '', label: 'Tous les biens' },
                      ...(Array.isArray(properties) ? properties.map((property) => ({
                        value: property.id,
                        label: property.name,
                      })) : []),
                    ]}
                    placeholder="Tous les biens"
                    aria-label="Filtrer par bien"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="filter-tenantId">
                  Locataire
                </label>
                <SmartSelect
                  id="filter-tenantId"
                  value={filters.tenantId}
                  onChange={(value) => handleFilterChange('tenantId', value)}
                  options={[
                    { value: '', label: 'Tous les locataires' },
                    ...(Array.isArray(tenants) ? tenants.map((tenant) => ({
                      value: tenant.id,
                      label: `${tenant.firstName} ${tenant.lastName}`,
                    })) : []),
                  ]}
                  placeholder="Tous les locataires"
                  aria-label="Filtrer par locataire"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="filter-type">
                  Type de bail
                </label>
                <SmartSelect
                  id="filter-type"
                  value={filters.type}
                  onChange={(value) => handleFilterChange('type', value)}
                  options={TYPE_OPTIONS}
                  placeholder="Tous les types"
                  aria-label="Filtrer par type de bail"
                />
              </div>
            </div>

            {/* Ligne 3: Type de meublé, Statut workflow */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="filter-furnishedType">
                  Type de meublé
                </label>
                <SmartSelect
                  id="filter-furnishedType"
                  value={filters.furnishedType}
                  onChange={(value) => handleFilterChange('furnishedType', value)}
                  options={FURNISHED_TYPE_OPTIONS}
                  placeholder="Tous"
                  aria-label="Filtrer par type de meublé"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="filter-status">
                  Statut workflow
                </label>
                <SmartSelect
                  id="filter-status"
                  value={filters.status}
                  onChange={(value) => handleFilterChange('status', value)}
                  options={STATUS_OPTIONS}
                  placeholder="Tous les statuts"
                  aria-label="Filtrer par statut"
                />
              </div>
            </div>

            {/* Ligne 4: Dates de début */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="filter-startDateFrom">
                  Date de début (de)
                </label>
                <SmartDatePicker
                  id="filter-startDateFrom"
                  value={filters.startDateFrom}
                  onChange={(value) => handleFilterChange('startDateFrom', value)}
                  placeholder="Sélectionner une date"
                  aria-label="Date de début (de)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="filter-startDateTo">
                  Date de début (à)
                </label>
                <SmartDatePicker
                  id="filter-startDateTo"
                  value={filters.startDateTo}
                  onChange={(value) => handleFilterChange('startDateTo', value)}
                  placeholder="Sélectionner une date"
                  aria-label="Date de début (à)"
                />
              </div>
            </div>

            {/* Ligne 5: Dates de fin */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="filter-endDateFrom">
                  Date de fin (de)
                </label>
                <SmartDatePicker
                  id="filter-endDateFrom"
                  value={filters.endDateFrom}
                  onChange={(value) => handleFilterChange('endDateFrom', value)}
                  placeholder="Sélectionner une date"
                  aria-label="Date de fin (de)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="filter-endDateTo">
                  Date de fin (à)
                </label>
                <SmartDatePicker
                  id="filter-endDateTo"
                  value={filters.endDateTo}
                  onChange={(value) => handleFilterChange('endDateTo', value)}
                  placeholder="Sélectionner une date"
                  aria-label="Date de fin (à)"
                />
              </div>
            </div>

            {/* Ligne 6: Indexation */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="filter-indexationType">
                  Type d'indexation
                </label>
                <SmartSelect
                  id="filter-indexationType"
                  value={filters.indexationType}
                  onChange={(value) => handleFilterChange('indexationType', value)}
                  options={INDEXATION_TYPE_OPTIONS}
                  placeholder="Tous"
                  aria-label="Filtrer par type d'indexation"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="filter-indexationDateFrom">
                  Prochaine indexation (de)
                </label>
                <SmartDatePicker
                  id="filter-indexationDateFrom"
                  value={filters.indexationDateFrom}
                  onChange={(value) => handleFilterChange('indexationDateFrom', value)}
                  placeholder="Sélectionner une date"
                  aria-label="Prochaine indexation (de)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="filter-indexationDateTo">
                  Prochaine indexation (à)
                </label>
                <SmartDatePicker
                  id="filter-indexationDateTo"
                  value={filters.indexationDateTo}
                  onChange={(value) => handleFilterChange('indexationDateTo', value)}
                  placeholder="Sélectionner une date"
                  aria-label="Prochaine indexation (à)"
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

