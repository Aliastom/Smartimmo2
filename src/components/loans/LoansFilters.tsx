'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
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

  const hasActiveFilters = filters.search || filters.propertyId || filters.active !== '1';

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
    <div className="bg-white rounded-xl border border-gray-200">
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
            <Badge
              key={qf.id}
              variant={filters.active === qf.active ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => handleQuickFilter(qf.active)}
            >
              {qf.label}
            </Badge>
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
              <Input
                id="period-start"
                type="month"
                value={periodStart}
                onChange={(e) => onPeriodChange(e.target.value, periodEnd)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period-end">Période à</Label>
              <Input
                id="period-end"
                type="month"
                value={periodEnd}
                onChange={(e) => onPeriodChange(periodStart, e.target.value)}
              />
            </div>
          </div>

          {/* Filtre Bien */}
          {!hidePropertyFilter && (
            <div className="space-y-2">
              <Label htmlFor="filter-property">Bien</Label>
              <Select
                id="filter-property"
                value={filters.propertyId}
                onChange={(e) => handleFilterChange('propertyId', e.target.value)}
              >
                <option value="">Tous les biens</option>
                {Array.isArray(properties) && properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
