'use client';

import React, { useState, useMemo } from 'react';
import { Search, Filter, X, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SmartSelect, SmartSelectOption } from '@/components/ui/SmartSelect';
import { SmartDatePicker } from '@/components/ui/SmartDatePicker';

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
    paidAtFrom: string;
    paidAtTo: string;
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
  natures: any[];
  // Nouveaux props pour la période
  periodStart?: string;
  periodEnd?: string;
  onPeriodChange?: (start: string, end: string) => void;
  // Masquer le filtre Bien (pour l'onglet bien)
  hidePropertyFilter?: boolean;
  /** Faux par défaut : filtres secondaires repliés (vue globale plus lisible) */
  defaultAdvancedOpen?: boolean;
}

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
  natures,
  periodStart,
  periodEnd,
  onPeriodChange,
  hidePropertyFilter = false,
  defaultAdvancedOpen = false,
}: TransactionFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(defaultAdvancedOpen);
  
  // Filtrer les catégories en fonction de la nature sélectionnée
  const filteredCategories = useMemo(() => {
    if (!filters.natureId) return categories;
    
    // Trouver la nature sélectionnée pour obtenir son flow
    const selectedNature = natures.find(n => n.key === filters.natureId);
    if (!selectedNature) {
      console.log('[TransactionFilters] Nature non trouvée:', filters.natureId, 'dans', natures.map(n => n.key));
      return categories;
    }
    
    // Utiliser les compatibleTypes de la nature pour filtrer les catégories
    const compatibleTypes = selectedNature.compatibleTypes || [];
    console.log('[TransactionFilters] Nature sélectionnée:', selectedNature.key, 'Types compatibles:', compatibleTypes);
    
    // Si pas de types compatibles définis, retourner toutes les catégories
    if (!compatibleTypes || compatibleTypes.length === 0) {
      console.log('[TransactionFilters] Aucun type compatible défini, affichage de toutes les catégories');
      return categories;
    }
    
    // Filtrer les catégories dont le type est dans compatibleTypes
    const filtered = categories.filter(c => compatibleTypes.includes(c.type));
    
    console.log('[TransactionFilters] Catégories filtrées:', filtered.length, '/', categories.length, '- Types acceptés:', compatibleTypes);
    return filtered;
  }, [categories, natures, filters.natureId]);

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
    const entries = Object.entries(restrictiveFilters).filter(([key]) => {
      if (hidePropertyFilter && key === 'propertyId') return false;
      return true;
    });
    return entries.filter(([, v]) => v !== '' && v !== null && v !== undefined).length;
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
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 gap-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
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
          type="button"
          aria-expanded={isExpanded}
          aria-controls="transaction-filters-advanced"
          onClick={() => setIsExpanded(!isExpanded)}
          className="shrink-0 gap-1.5 text-gray-700"
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden />
          )}
          <Filter className="h-4 w-4" aria-hidden />
          <span className="whitespace-nowrap text-sm">
            {isExpanded ? 'Moins de critères' : 'Plus de critères'}
          </span>
          <span
            className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
              isExpanded ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {isExpanded ? 'Ouvert' : 'Fermé'}
          </span>
        </Button>
      </div>

      {/* Contenu - Style Documents */}
      <div className="px-4 sm:px-6 py-4 space-y-4">
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
                    ? 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                📅 Tous
              </button>
              <button
                onClick={() => handleQuickPeriod('current-month')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  activePeriod === 'current-month'
                    ? 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                Mois courant
              </button>
              <button
                onClick={() => handleQuickPeriod('current-year')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  activePeriod === 'current-year'
                    ? 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                Année courante
              </button>
              <button
                onClick={() => handleQuickPeriod('last-3-months')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  activePeriod === 'last-3-months'
                    ? 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                3 derniers mois
              </button>
              <button
                onClick={() => handleQuickPeriod('last-12-months')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  activePeriod === 'last-12-months'
                    ? 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                12 derniers mois
              </button>
            </div>
          </div>
        )}

        {/* Recherche + bien (portefeuille) + reset */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <Input
              type="text"
              placeholder="Rechercher par libellé, référence..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="flex-1 min-w-0"
            />
            {hasActiveFilters && (
              <Button type="button" variant="outline" onClick={onResetFilters} className="shrink-0 w-full sm:w-auto">
                Réinitialiser
              </Button>
            )}
          </div>
          {!hidePropertyFilter && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bien</label>
              <SmartSelect
                value={filters.propertyId}
                onChange={(value) => handleFilterChange('propertyId', value)}
                options={[
                  { value: '', label: 'Tous les biens' },
                  ...(Array.isArray(properties)
                    ? properties.map((property) => ({
                        value: property.id,
                        label: `${property.name} - ${property.address}`,
                      }))
                    : []),
                ]}
                placeholder="Tous les biens"
              />
            </div>
          )}
        </div>
      </div>

      {/* Filtres étendus - Style Documents */}
      {isExpanded && (
        <div
          id="transaction-filters-advanced"
          className="px-4 sm:px-6 pb-4 pt-4 border-t space-y-4"
          role="region"
          aria-label="Critères de filtre avancés"
        >
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <input
              type="checkbox"
              id="includeArchivedProperties"
              checked={filters.includeArchived === true}
              onChange={(e) => handleFilterChange('includeArchived', e.target.checked)}
              className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
            />
            <label htmlFor="includeArchivedProperties" className="text-sm text-gray-700 cursor-pointer select-none">
              Inclure les biens archivés
            </label>
            {filters.includeArchived && (
              <span className="text-xs text-orange-600 font-medium">Actif</span>
            )}
          </div>

          {/* Sélecteurs de période détaillés */}
          {periodStart && periodEnd && onPeriodChange && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-4 border-b">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Du</label>
                <div className="flex gap-2">
                  <SmartSelect
                    value={startParsed?.month || ''}
                    onChange={(value) => handlePeriodStartChange(undefined, value)}
                    options={months.map(m => ({ value: m.value, label: m.label }))}
                    placeholder="Mois"
                    className="flex-1"
                  />
                  <SmartSelect
                    value={startParsed?.year?.toString() || ''}
                    onChange={(value) => handlePeriodStartChange(parseInt(value), undefined)}
                    options={years.map(y => ({ value: y.toString(), label: y.toString() }))}
                    placeholder="Année"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Au</label>
                <div className="flex gap-2">
                  <SmartSelect
                    value={endParsed?.month || ''}
                    onChange={(value) => handlePeriodEndChange(undefined, value)}
                    options={months.map(m => ({ value: m.value, label: m.label }))}
                    placeholder="Mois"
                    className="flex-1"
                  />
                  <SmartSelect
                    value={endParsed?.year?.toString() || ''}
                    onChange={(value) => handlePeriodEndChange(parseInt(value), undefined)}
                    options={years.map(y => ({ value: y.toString(), label: y.toString() }))}
                    placeholder="Année"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Filtres Nature et Catégorie côte à côte */}
          <div className="pb-4 border-b">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Filtre Nature */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nature
                </label>
                <SmartSelect
                  value={filters.natureId}
                  onChange={(value) => {
                    // Réinitialiser la catégorie quand on change de nature (en un seul appel)
                    onFiltersChange({
                      ...filters,
                      natureId: value,
                      categoryId: value !== filters.natureId ? '' : filters.categoryId
                    });
                  }}
                  options={[
                    { value: '', label: 'Toutes les natures' },
                    ...(Array.isArray(natures) ? natures.map(nature => ({
                      value: nature.key,
                      label: `${nature.label} (${(nature.flow || '').toLowerCase()})`
                    })) : [])
                  ]}
                  placeholder="Sélectionner une nature"
                />
              </div>
              
              {/* Filtre Catégorie */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Catégorie comptable
                </label>
                <SmartSelect
                  value={filters.categoryId}
                  onChange={(value) => handleFilterChange('categoryId', value)}
                  options={[
                    { value: '', label: 'Toutes les catégories' },
                    ...(Array.isArray(filteredCategories) ? filteredCategories.map(category => ({
                      value: category.id,
                      label: category.label
                    })) : [])
                  ]}
                  placeholder="Catégorie"
                  disabled={!filters.natureId && filteredCategories.length === categories.length}
                />
              </div>
            </div>
          </div>

          {/* Filtres avancés (sans le sélecteur Bien — déjà en accès direct si portefeuille) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Bail */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bail
              </label>
              <SmartSelect
                value={filters.leaseId}
                onChange={(value) => handleFilterChange('leaseId', value)}
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
              <SmartSelect
                value={filters.tenantId}
                onChange={(value) => handleFilterChange('tenantId', value)}
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

            {/* Date du (date transaction) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date du
              </label>
              <SmartDatePicker
                value={filters.dateFrom}
                onChange={(value) => handleFilterChange('dateFrom', value)}
                placeholder="jj/mm/aaaa"
              />
            </div>

            {/* Date au (date transaction) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date au
              </label>
              <SmartDatePicker
                value={filters.dateTo}
                onChange={(value) => handleFilterChange('dateTo', value)}
                placeholder="jj/mm/aaaa"
              />
            </div>

            {/* Date encaissement du */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" title="Date à laquelle le paiement a été reçu">
                Encaissement du
              </label>
              <SmartDatePicker
                value={filters.paidAtFrom}
                onChange={(value) => handleFilterChange('paidAtFrom', value)}
                placeholder="jj/mm/aaaa"
              />
            </div>

            {/* Date encaissement au */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" title="Date à laquelle le paiement a été reçu">
                Encaissement au
              </label>
              <SmartDatePicker
                value={filters.paidAtTo}
                onChange={(value) => handleFilterChange('paidAtTo', value)}
                placeholder="jj/mm/aaaa"
              />
            </div>

            {/* Avec document */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Document
              </label>
              <SmartSelect
                value={filters.hasDocument}
                onChange={(value) => handleFilterChange('hasDocument', value)}
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
