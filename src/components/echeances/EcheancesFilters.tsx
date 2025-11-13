'use client';

import React, { useState } from 'react';
import { Search, Filter, X, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ECHEANCE_TYPE_LABELS, PERIODICITE_LABELS, SENS_LABELS } from '@/types/echeance';

interface EcheancesFiltersProps {
  filters: {
    search: string;
    type: string;
    sens: string;
    periodicite: string;
    propertyId: string;
    leaseId: string;
    recuperable: string;
  };
  onFiltersChange: (filters: any) => void;
  onResetFilters: () => void;
  properties: any[];
  leases: any[];
  // Props pour la période
  periodStart: string;
  periodEnd: string;
  onPeriodChange: (start: string, end: string) => void;
  viewMode: 'monthly' | 'yearly';
  onViewModeChange: (mode: 'monthly' | 'yearly') => void;
  // Masquer le filtre Bien (pour page bien/id/echeances)
  hidePropertyFilter?: boolean;
}

export default function EcheancesFilters({
  filters,
  onFiltersChange,
  onResetFilters,
  properties,
  leases,
  periodStart,
  periodEnd,
  onPeriodChange,
  viewMode,
  onViewModeChange,
  hidePropertyFilter = false,
}: EcheancesFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleFilterChange = (key: string, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const handleQuickPeriod = (type: 'current-month' | '3-months' | '12-months' | 'current-year' | '3-years' | '5-years' | '10-years') => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    let start = '';
    let end = '';
    let mode: 'monthly' | 'yearly' = 'monthly';

    switch (type) {
      case 'current-month':
        start = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
        end = start;
        mode = 'monthly';
        break;
      case '3-months':
        const threeMonthsLater = new Date(now);
        threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 2);
        start = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
        end = `${threeMonthsLater.getFullYear()}-${String(threeMonthsLater.getMonth() + 1).padStart(2, '0')}`;
        mode = 'monthly';
        break;
      case '12-months':
        const twelveMonthsLater = new Date(now);
        twelveMonthsLater.setMonth(twelveMonthsLater.getMonth() + 11);
        start = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
        end = `${twelveMonthsLater.getFullYear()}-${String(twelveMonthsLater.getMonth() + 1).padStart(2, '0')}`;
        mode = 'monthly';
        break;
      case 'current-year':
        start = `${currentYear}-01`;
        end = `${currentYear}-12`;
        mode = 'monthly';
        break;
      case '3-years':
        start = `${currentYear}-01`;
        end = `${currentYear + 2}-12`;
        mode = 'yearly';
        break;
      case '5-years':
        start = `${currentYear}-01`;
        end = `${currentYear + 4}-12`;
        mode = 'yearly';
        break;
      case '10-years':
        start = `${currentYear}-01`;
        end = `${currentYear + 9}-12`;
        mode = 'yearly';
        break;
    }

    onPeriodChange(start, end);
    onViewModeChange(mode);
  };

  // Déterminer quelle période est active
  const getActivePeriod = (): string => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (periodStart === currentMonth && periodEnd === currentMonth) {
      return 'current-month';
    }
    if (periodStart === `${currentYear}-01` && periodEnd === `${currentYear}-12`) {
      return 'current-year';
    }
    if (periodEnd === `${currentYear + 2}-12` && viewMode === 'yearly') {
      return '3-years';
    }
    if (periodEnd === `${currentYear + 4}-12` && viewMode === 'yearly') {
      return '5-years';
    }
    if (periodEnd === `${currentYear + 9}-12` && viewMode === 'yearly') {
      return '10-years';
    }
    
    return 'custom';
  };

  const activePeriod = getActivePeriod();

  const countActiveFilters = () => {
    return Object.values(filters).filter(v => v !== '' && v !== null && v !== undefined).length;
  };
  
  const activeFiltersCount = countActiveFilters();
  const hasActiveFilters = activeFiltersCount > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 mb-6">
      {/* Header avec bouton toggle */}
      <div className="flex items-center justify-between px-6 py-4">
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

      {/* Contenu - Toujours visible */}
      <div className="px-6 py-4 space-y-4">
        {/* Période de projection - Toujours visible */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Période de projection (prévisionnel)</span>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleQuickPeriod('current-month')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activePeriod === 'current-month'
                  ? 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              Mois en cours
            </button>
            <button
              onClick={() => handleQuickPeriod('3-months')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activePeriod === '3-months'
                  ? 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              3 prochains mois
            </button>
            <button
              onClick={() => handleQuickPeriod('12-months')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activePeriod === '12-months'
                  ? 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              12 prochains mois
            </button>
            <button
              onClick={() => handleQuickPeriod('current-year')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activePeriod === 'current-year'
                  ? 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              Année {new Date().getFullYear()}
            </button>
            <button
              onClick={() => handleQuickPeriod('3-years')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activePeriod === '3-years'
                  ? 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              3 années à venir
            </button>
            <button
              onClick={() => handleQuickPeriod('5-years')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activePeriod === '5-years'
                  ? 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              5 années à venir
            </button>
            <button
              onClick={() => handleQuickPeriod('10-years')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activePeriod === '10-years'
                  ? 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              10 années à venir
            </button>
          </div>
        </div>

        {/* Champ de recherche */}
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Rechercher par libellé..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="flex-1"
          />
          {hasActiveFilters && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={onResetFilters}
            >
              Réinitialiser
            </Button>
          )}
        </div>
      </div>

      {/* Filtres étendus */}
      {isExpanded && (
        <div className="px-6 pb-4 pt-4 border-t space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <Select
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="w-full"
              >
                <option value="">Tous les types</option>
                {Object.entries(ECHEANCE_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </Select>
            </div>

            {/* Sens */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sens</label>
              <Select
                value={filters.sens}
                onChange={(e) => handleFilterChange('sens', e.target.value)}
                className="w-full"
              >
                <option value="">Tous</option>
                {Object.entries(SENS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </Select>
            </div>

            {/* Périodicité */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Périodicité</label>
              <Select
                value={filters.periodicite}
                onChange={(e) => handleFilterChange('periodicite', e.target.value)}
                className="w-full"
              >
                <option value="">Toutes</option>
                {Object.entries(PERIODICITE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </Select>
            </div>

            {/* Bien (masqué si hidePropertyFilter) */}
            {!hidePropertyFilter && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bien</label>
                <Select
                  value={filters.propertyId}
                  onChange={(e) => handleFilterChange('propertyId', e.target.value)}
                  className="w-full"
                >
                  <option value="">Tous les biens</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>{property.name}</option>
                  ))}
                </Select>
              </div>
            )}

            {/* Récupérable */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Récupérable</label>
              <Select
                value={filters.recuperable}
                onChange={(e) => handleFilterChange('recuperable', e.target.value)}
                className="w-full"
              >
                <option value="">Toutes</option>
                <option value="true">Récupérables uniquement</option>
                <option value="false">Non récupérables uniquement</option>
              </Select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
