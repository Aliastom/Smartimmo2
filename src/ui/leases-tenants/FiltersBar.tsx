'use client';

import React from 'react';
import { Search, Filter, X } from 'lucide-react';

interface LeaseFilters {
  propertyId?: string;
  type?: string;
  status?: string;
  year?: number;
  month?: number;
}

interface TenantFilters {
  hasActiveLeases?: boolean;
}

interface FiltersBarProps {
  type: 'leases' | 'tenants';
  search: string;
  onSearchChange: (search: string) => void;
  leaseFilters?: LeaseFilters;
  tenantFilters?: TenantFilters;
  onLeaseFiltersChange?: (filters: LeaseFilters) => void;
  onTenantFiltersChange?: (filters: TenantFilters) => void;
  properties?: Array<{ id: string; name: string }>;
}

export default function FiltersBar({
  type,
  search,
  onSearchChange,
  leaseFilters = {},
  tenantFilters = {},
  onLeaseFiltersChange,
  onTenantFiltersChange,
  properties = []
}: FiltersBarProps) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    { value: 1, label: 'Janvier' },
    { value: 2, label: 'Février' },
    { value: 3, label: 'Mars' },
    { value: 4, label: 'Avril' },
    { value: 5, label: 'Mai' },
    { value: 6, label: 'Juin' },
    { value: 7, label: 'Juillet' },
    { value: 8, label: 'Août' },
    { value: 9, label: 'Septembre' },
    { value: 10, label: 'Octobre' },
    { value: 11, label: 'Novembre' },
    { value: 12, label: 'Décembre' }
  ];

  const clearFilters = () => {
    if (type === 'leases' && onLeaseFiltersChange) {
      onLeaseFiltersChange({});
    } else if (type === 'tenants' && onTenantFiltersChange) {
      onTenantFiltersChange({});
    }
    onSearchChange('');
  };

  const hasActiveFilters = search || 
    (type === 'leases' && Object.values(leaseFilters).some(v => v !== undefined)) ||
    (type === 'tenants' && Object.values(tenantFilters).some(v => v !== undefined));

  return (
    <div className="bg-base-100 border-b border-neutral-200 p-4 space-y-4">
      {/* Barre de recherche */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 h-4 w-4" />
          <input
            type="text"
            placeholder={`Rechercher ${type === 'leases' ? 'des baux' : 'des locataires'}...`}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
          />
        </div>
        
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center space-x-1 text-neutral-600 hover:text-neutral-800 transition"
          >
            <X className="h-4 w-4" />
            <span>Effacer les filtres</span>
          </button>
        )}
      </div>

      {/* Filtres spécifiques */}
      <div className="flex flex-wrap items-center gap-4">
        {type === 'leases' && (
          <>
            {/* Filtre par propriété */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-neutral-700">Bien:</label>
              <select
                value={leaseFilters.propertyId || ''}
                onChange={(e) => onLeaseFiltersChange?.({ ...leaseFilters, propertyId: e.target.value || undefined })}
                className="px-3 py-1 border border-neutral-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-primary"
              >
                <option value="">Tous les biens</option>
                {properties.map(property => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtre par type */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-neutral-700">Type:</label>
              <select
                value={leaseFilters.type || ''}
                onChange={(e) => onLeaseFiltersChange?.({ ...leaseFilters, type: e.target.value || undefined })}
                className="px-3 py-1 border border-neutral-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-primary"
              >
                <option value="">Tous les types</option>
                <option value="residential">Résidentiel</option>
                <option value="commercial">Commercial</option>
              </select>
            </div>

            {/* Filtre par statut */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-neutral-700">Statut:</label>
              <select
                value={leaseFilters.status || ''}
                onChange={(e) => onLeaseFiltersChange?.({ ...leaseFilters, status: e.target.value || undefined })}
                className="px-3 py-1 border border-neutral-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-primary"
              >
                <option value="">Tous les statuts</option>
                <option value="active">Actif</option>
                <option value="terminated">Terminé</option>
                <option value="renewed">Renouvelé</option>
              </select>
            </div>

            {/* Filtre par année */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-neutral-700">Année:</label>
              <select
                value={leaseFilters.year || ''}
                onChange={(e) => onLeaseFiltersChange?.({ ...leaseFilters, year: e.target.value ? parseInt(e.target.value) : undefined })}
                className="px-3 py-1 border border-neutral-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-primary"
              >
                <option value="">Toutes les années</option>
                {years.map(year => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtre par mois */}
            {leaseFilters.year && (
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-neutral-700">Mois:</label>
                <select
                  value={leaseFilters.month || ''}
                  onChange={(e) => onLeaseFiltersChange?.({ ...leaseFilters, month: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="px-3 py-1 border border-neutral-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-primary"
                >
                  <option value="">Tous les mois</option>
                  {months.map(month => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        {type === 'tenants' && (
          <>
            {/* Filtre par baux actifs */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-neutral-700">Baux actifs:</label>
              <select
                value={tenantFilters.hasActiveLeases ? 'true' : ''}
                onChange={(e) => onTenantFiltersChange?.({ hasActiveLeases: e.target.value === 'true' })}
                className="px-3 py-1 border border-neutral-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-primary"
              >
                <option value="">Tous les locataires</option>
                <option value="true">Avec baux actifs</option>
                <option value="false">Sans baux actifs</option>
              </select>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
