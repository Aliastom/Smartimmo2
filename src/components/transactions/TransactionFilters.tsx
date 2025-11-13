'use client';

import React, { useState } from 'react';
import { Search, Filter, X, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

interface TransactionFiltersProps {
  filters: {
    search: string;
    propertyId: string;
    leaseId: string;
    tenantId: string;
    natureId: string;
    categoryId: string;
    amountMin: string;
    amountMax: string;
    dateFrom: string;
    dateTo: string;
    status: string;
    hasDocument: string;
    includeManagementFees?: boolean;
    groupByParent?: boolean;
    includeArchived?: boolean;
  };
  onFiltersChange: (filters: any) => void;
  onResetFilters: () => void;
  properties: any[];
  leases: any[];
  tenants: any[];
  categories: any[];
  // Nouveaux props pour la période
  periodStart?: string;
  periodEnd?: string;
  onPeriodChange?: (start: string, end: string) => void;
  // Masquer le filtre Bien (pour l'onglet bien)
  hidePropertyFilter?: boolean;
}

const NATURE_OPTIONS = [
  { value: '', label: 'Toutes les natures' },
  { value: 'LOYER', label: 'Loyer (recette)' },
  { value: 'CHARGES', label: 'Charges (recette)' },
  { value: 'DEPOT_GARANTIE', label: 'Dépôt de garantie (recette)' },
  { value: 'FRAIS_AGENCE', label: 'Frais d\'agence (recette)' },
  { value: 'TRAVAUX', label: 'Travaux (dépense)' },
  { value: 'ENTRETIEN', label: 'Entretien (dépense)' },
  { value: 'ASSURANCE', label: 'Assurance (dépense)' },
  { value: 'TAXES', label: 'Taxes (dépense)' },
  { value: 'AUTRE', label: 'Autre' }
];

// STATUS_OPTIONS supprimé - utiliser la carte KPI "Transactions non rapprochées" pour filtrer

const DOCUMENT_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'true', label: 'Avec document' },
  { value: 'false', label: 'Sans document' }
];

export default function TransactionFilters({
  filters,
  onFiltersChange,
  onResetFilters,
  properties,
  leases,
  tenants,
  categories,
  periodStart,
  periodEnd,
  onPeriodChange,
  hidePropertyFilter = false
}: TransactionFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleFilterChange = (key: string, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  // Gestion de la période
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    { value: '01', label: 'Janvier' },
    { value: '02', label: 'Février' },
    { value: '03', label: 'Mars' },
    { value: '04', label: 'Avril' },
    { value: '05', label: 'Mai' },
    { value: '06', label: 'Juin' },
    { value: '07', label: 'Juillet' },
    { value: '08', label: 'Août' },
    { value: '09', label: 'Septembre' },
    { value: '10', label: 'Octobre' },
    { value: '11', label: 'Novembre' },
    { value: '12', label: 'Décembre' },
  ];

  const parseYearMonth = (yyyymm: string) => {
    const [year, month] = yyyymm.split('-');
    return { year: parseInt(year), month };
  };

  const handlePeriodStartChange = (year?: number, month?: string) => {
    if (!onPeriodChange || !periodStart) return;
    const current = parseYearMonth(periodStart);
    const newYear = year ?? current.year;
    const newMonth = month ?? current.month;
    const newStart = `${newYear}-${newMonth}`;
    onPeriodChange(newStart, periodEnd || newStart);
  };

  const handlePeriodEndChange = (year?: number, month?: string) => {
    if (!onPeriodChange || !periodEnd) return;
    const current = parseYearMonth(periodEnd);
    const newYear = year ?? current.year;
    const newMonth = month ?? current.month;
    const newEnd = `${newYear}-${newMonth}`;
    onPeriodChange(periodStart || newEnd, newEnd);
  };

  const handleQuickPeriod = (type: 'current-month' | 'current-year' | 'last-3-months' | 'last-12-months' | 'all') => {
    if (!onPeriodChange) return;
    const now = new Date();
    let start = '';
    let end = '';

    switch (type) {
      case 'current-month':
        start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        end = start;
        break;
      case 'current-year':
        start = `${now.getFullYear()}-01`;
        end = `${now.getFullYear()}-12`;
        break;
      case 'last-3-months':
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        start = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}`;
        end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        break;
      case 'last-12-months':
        const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        start = `${twelveMonthsAgo.getFullYear()}-${String(twelveMonthsAgo.getMonth() + 1).padStart(2, '0')}`;
        end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        break;
      case 'all':
        // Période très large pour voir toutes les transactions
        start = `2020-01`;
        end = `${now.getFullYear() + 1}-12`;
        break;
    }

    onPeriodChange(start, end);
  };

  const startParsed = periodStart ? parseYearMonth(periodStart) : null;
  const endParsed = periodEnd ? parseYearMonth(periodEnd) : null;

  // Compter uniquement les vrais filtres restrictifs (exclure les options d'affichage)
  const countActiveFilters = () => {
    const { includeManagementFees, groupByParent, includeArchived, ...restrictiveFilters } = filters;
    return Object.values(restrictiveFilters).filter(v => v !== '' && v !== null && v !== undefined).length;
  };
  
  const activeFiltersCount = countActiveFilters();
  const hasActiveFilters = activeFiltersCount > 0;

  // Déterminer quelle période est active
  const getActivePeriod = (): string => {
    if (!periodStart || !periodEnd) return 'none';
    
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentYear = now.getFullYear();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const threeMonthsAgoStr = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}`;
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const twelveMonthsAgoStr = `${twelveMonthsAgo.getFullYear()}-${String(twelveMonthsAgo.getMonth() + 1).padStart(2, '0')}`;

    // Vérifier chaque période
    if (periodStart === currentMonth && periodEnd === currentMonth) {
      return 'current-month';
    }
    if (periodStart === `${currentYear}-01` && periodEnd === `${currentYear}-12`) {
      return 'current-year';
    }
    if (periodStart === threeMonthsAgoStr && periodEnd === currentMonth) {
      return 'last-3-months';
    }
    if (periodStart === twelveMonthsAgoStr && periodEnd === currentMonth) {
      return 'last-12-months';
    }
    if (periodStart === '2020-01' && parseInt(periodEnd.split('-')[0]) >= currentYear + 1) {
      return 'all';
    }
    
    return 'custom'; // Période personnalisée
  };

  const activePeriod = getActivePeriod();

  return (
    <div className="bg-white rounded-xl border border-gray-200 mb-6">
      {/* Header avec bouton toggle - Style Documents */}
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

      {/* Contenu - Style Documents */}
      <div className="px-6 py-4 space-y-4">
        {/* Période comptable - Toujours visible */}
        {periodStart && periodEnd && onPeriodChange && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Période comptable</span>
            </div>
            
            {/* Raccourcis uniquement */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleQuickPeriod('all')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  activePeriod === 'all'
                    ? 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                📅 Tous
              </button>
              <button
                onClick={() => handleQuickPeriod('current-month')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  activePeriod === 'current-month'
                    ? 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                Mois courant
              </button>
              <button
                onClick={() => handleQuickPeriod('current-year')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  activePeriod === 'current-year'
                    ? 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                Année courante
              </button>
              <button
                onClick={() => handleQuickPeriod('last-3-months')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  activePeriod === 'last-3-months'
                    ? 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                3 derniers mois
              </button>
              <button
                onClick={() => handleQuickPeriod('last-12-months')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  activePeriod === 'last-12-months'
                    ? 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                12 derniers mois
              </button>
            </div>
          </div>
        )}

        {/* Champ de recherche - Recherche directe (comme Documents) */}
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Rechercher par libellé, référence..."
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
        
        {/* Checkbox "Inclure les biens archivés" - TOUJOURS VISIBLE */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="includeArchivedProperties"
            checked={filters.includeArchived === true}
            onChange={(e) => handleFilterChange('includeArchived', e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
          />
          <label htmlFor="includeArchivedProperties" className="text-sm text-gray-700 cursor-pointer select-none">
            Inclure les biens archivés
          </label>
          {filters.includeArchived && (
            <span className="text-xs text-blue-600 font-medium">Actif</span>
          )}
        </div>
      </div>

      {/* Filtres étendus - Style Documents */}
      {isExpanded && (
        <div className="px-6 pb-4 pt-4 border-t space-y-4">
          {/* Sélecteurs de période détaillés */}
          {periodStart && periodEnd && onPeriodChange && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-4 border-b">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Du</label>
                <div className="flex gap-2">
                  <select
                    value={startParsed?.month}
                    onChange={(e) => handlePeriodStartChange(undefined, e.target.value)}
                    className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {months.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={startParsed?.year}
                    onChange={(e) => handlePeriodStartChange(parseInt(e.target.value), undefined)}
                    className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Au</label>
                <div className="flex gap-2">
                  <select
                    value={endParsed?.month}
                    onChange={(e) => handlePeriodEndChange(undefined, e.target.value)}
                    className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {months.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={endParsed?.year}
                    onChange={(e) => handlePeriodEndChange(parseInt(e.target.value), undefined)}
                    className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Filtre Nature */}
          <div className="pb-4 border-b">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nature
            </label>
            <Select
              value={filters.natureId}
              onChange={(e) => handleFilterChange('natureId', e.target.value)}
              options={NATURE_OPTIONS}
              placeholder="Nature"
            />
          </div>

          {/* Filtres avancés */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Bien - masqué dans le contexte d'un bien */}
            {!hidePropertyFilter && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bien
                </label>
                <Select
                  value={filters.propertyId}
                  onChange={(e) => handleFilterChange('propertyId', e.target.value)}
                  options={[
                    { value: '', label: 'Tous les biens' },
                    ...(Array.isArray(properties) ? properties.map(property => ({
                      value: property.id,
                      label: `${property.name} - ${property.address}`
                    })) : [])
                  ]}
                  placeholder="Sélectionner un bien"
                />
              </div>
            )}

            {/* Bail */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bail
              </label>
              <Select
                value={filters.leaseId}
                onChange={(e) => handleFilterChange('leaseId', e.target.value)}
                options={[
                  { value: '', label: 'Tous les baux' },
                  ...(Array.isArray(leases) ? leases.map(lease => ({
                    value: lease.id,
                    label: `${lease.Tenant?.firstName} ${lease.Tenant?.lastName} - ${lease.status}`
                  })) : [])
                ]}
                placeholder="Sélectionner un bail"
              />
            </div>

            {/* Locataire */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Locataire
              </label>
              <Select
                value={filters.tenantId}
                onChange={(e) => handleFilterChange('tenantId', e.target.value)}
                options={[
                  { value: '', label: 'Tous les locataires' },
                  ...(Array.isArray(tenants) ? tenants.map(tenant => ({
                    value: tenant.id,
                    label: `${tenant.firstName} ${tenant.lastName}`
                  })) : [])
                ]}
                placeholder="Sélectionner un locataire"
              />
            </div>

            {/* Catégorie */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Catégorie
              </label>
              <Select
                value={filters.categoryId}
                onChange={(e) => handleFilterChange('categoryId', e.target.value)}
                options={[
                  { value: '', label: 'Toutes les catégories' },
                  ...(Array.isArray(categories) ? categories.map(category => ({
                    value: category.id,
                    label: category.label
                  })) : [])
                ]}
                placeholder="Sélectionner une catégorie"
              />
            </div>

            {/* Montant min */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Montant minimum (€)
              </label>
              <Input
                type="number"
                step="0.01"
                value={filters.amountMin}
                onChange={(e) => handleFilterChange('amountMin', e.target.value)}
                placeholder="0.00"
              />
            </div>

            {/* Montant max */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Montant maximum (€)
              </label>
              <Input
                type="number"
                step="0.01"
                value={filters.amountMax}
                onChange={(e) => handleFilterChange('amountMax', e.target.value)}
                placeholder="999999.99"
              />
            </div>

            {/* Date du */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date du
              </label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>

            {/* Date au */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date au
              </label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>

            {/* Avec document */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Document
              </label>
              <Select
                value={filters.hasDocument}
                onChange={(e) => handleFilterChange('hasDocument', e.target.value)}
                options={DOCUMENT_OPTIONS}
                placeholder="Filtrer par document"
              />
            </div>
          </div>

          {/* Filtres Gestion déléguée */}
          {process.env.NEXT_PUBLIC_ENABLE_GESTION_SOCIETE === 'true' && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Gestion déléguée</h4>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.includeManagementFees !== false}
                    onChange={(e) => handleFilterChange('includeManagementFees', e.target.checked)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Inclure frais de gestion</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.groupByParent === true}
                    onChange={(e) => handleFilterChange('groupByParent', e.target.checked)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Grouper par parent (loyer + commission)</span>
                </label>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
