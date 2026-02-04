'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { SmartSelect, SmartSelectOption } from '@/components/ui/SmartSelect';
import { SmartDatePicker } from '@/components/ui/SmartDatePicker';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { X, Filter, ChevronDown, ChevronUp } from 'lucide-react';

interface Property {
  id: string;
  name: string;
}

interface Filters {
  search: string;
  propertyId: string;
  active: string;
}

interface LoansFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  onResetFilters: () => void;
  properties: Property[];
  periodStart: string;
  periodEnd: string;
  onPeriodChange: (start: string, end: string) => void;
  hidePropertyFilter?: boolean;
}

export function LoansFilters({
  filters,
  onFiltersChange,
  onResetFilters,
  properties,
  periodStart,
  periodEnd,
  onPeriodChange,
  hidePropertyFilter = false,
}: LoansFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleFilterChange = (key: keyof Filters, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const hasActiveFilters = filters.search || (filters.propertyId && filters.propertyId !== '') || filters.active !== '';

  // Tags prédéfinis
  const quickFilters = [
    { id: 'tous', label: 'Tous les prêts', active: '' },
    { id: 'actifs', label: 'Actifs uniquement', active: '1' },
    { id: 'inactifs', label: 'Inactifs', active: '0' },
  ];

  const handleQuickFilter = (activeValue: string) => {
    handleFilterChange('active', activeValue);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 min-w-0">
      {/* Header filtres */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Filter className="h-5 w-5 text-gray-400" />
            <h3 className="text-sm font-medium text-gray-700">Filtres</h3>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={onResetFilters}>
                <X className="h-4 w-4 mr-1" />
                Réinitialiser
              </Button>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Réduire
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Étendre
              </>
            )}
          </Button>
        </div>

        {/* Tags prédéfinis + Recherche visible */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {quickFilters.map((qf) => (
            <button
              key={qf.id}
              onClick={() => handleQuickFilter(qf.active)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filters.active === qf.active
                  ? 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              {qf.label}
            </button>
          ))}
          {/* Recherche visible */}
          <div className="flex-1 min-w-[200px]">
            <Input
              id="filter-search"
              type="text"
              placeholder="Rechercher dans les libellés..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="h-8"
            />
          </div>
        </div>
      </div>

      {/* Filtres détaillés (conditionnels) */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Période */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="period-start">Période de</Label>
              <SmartDatePicker
                id="period-start"
                value={periodStart}
                onChange={(value) => onPeriodChange(value || periodStart, periodEnd)}
                placeholder="Sélectionner un mois"
                mode="month"
                aria-label="Période de début"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period-end">Période à</Label>
              <SmartDatePicker
                id="period-end"
                value={periodEnd}
                onChange={(value) => onPeriodChange(periodStart, value || periodEnd)}
                placeholder="Sélectionner un mois"
                mode="month"
                aria-label="Période de fin"
              />
            </div>
          </div>

          {/* Filtre Bien */}
          {!hidePropertyFilter && (
            <div className="space-y-2">
              <Label htmlFor="filter-property">Bien</Label>
              <SmartSelect
                value={filters.propertyId || ''}
                onChange={(value) => handleFilterChange('propertyId', value)}
                options={[
                  { value: '', label: 'Tous les biens' },
                  ...(Array.isArray(properties) ? properties.map((property): SmartSelectOption => ({
                    value: property.id,
                    label: property.name,
                  })) : []),
                ]}
                placeholder="Tous les biens"
                aria-label="Filtrer par bien"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
