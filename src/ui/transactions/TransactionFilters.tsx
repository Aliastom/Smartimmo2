'use client';

import React, { useState } from 'react';
import { Search, Filter, Calendar, Euro, X } from 'lucide-react';
import { TransactionCategoryBadge } from '@/ui/components/TransactionCategoryBadge';

interface TransactionFiltersProps {
  filters: {
    search?: string;
    category?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    amountMin?: number;
    amountMax?: number;
  };
  onFiltersChange: (filters: any) => void;
  onClearFilters: () => void;
}

const CATEGORIES = [
  'LOYER',
  'CHARGES', 
  'DEPOT_RECU',
  'DEPOT_RENDU',
  'AVOIR',
  'PENALITE',
  'AUTRE'
];

const STATUSES = [
  'PAID',
  'PARTIAL',
  'UNPAID',
  'OVERDUE'
];

export default function TransactionFilters({ 
  filters, 
  onFiltersChange, 
  onClearFilters 
}: TransactionFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleFilterChange = (key: string, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const hasActiveFilters = Object.values(filters).some(value => 
    value !== undefined && value !== '' && value !== null
  );

  return (
    <div className="bg-base-100 rounded-lg border border-neutral-200 p-4 mb-6">
      {/* Header avec recherche et toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Rechercher une transaction..."
              value={filters.search || ''}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="inline-flex items-center space-x-1 px-3 py-2 text-sm text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 rounded-md transition-colors"
            >
              <X size={16} />
              <span>Effacer</span>
            </button>
          )}
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center space-x-2 px-3 py-2 text-sm font-medium text-primary hover:text-primary hover:bg-blue-50 rounded-md transition-colors"
          >
            <Filter size={16} />
            <span>Filtres</span>
          </button>
        </div>
      </div>

      {/* Filtres étendus */}
      {isExpanded && (
        <div className="space-y-4 pt-4 border-t border-neutral-200">
          {/* Catégories */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Catégorie
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => handleFilterChange('category', 
                    filters.Category === category ? undefined : category
                  )}
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    filters.Category === category
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 border border-neutral-200'
                  }`}
                >
                  <TransactionCategoryBadge category={category} />
                </button>
              ))}
            </div>
          </div>

          {/* Période */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                <Calendar size={16} className="inline mr-1" />
                Date de début
              </label>
              <input
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                <Calendar size={16} className="inline mr-1" />
                Date de fin
              </label>
              <input
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Montant */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                <Euro size={16} className="inline mr-1" />
                Montant minimum
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={filters.amountMin || ''}
                onChange={(e) => handleFilterChange('amountMin', 
                  e.target.value ? parseFloat(e.target.value) : undefined
                )}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                <Euro size={16} className="inline mr-1" />
                Montant maximum
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={filters.amountMax || ''}
                onChange={(e) => handleFilterChange('amountMax', 
                  e.target.value ? parseFloat(e.target.value) : undefined
                )}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Statut */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Statut
            </label>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((status) => (
                <button
                  key={status}
                  onClick={() => handleFilterChange('status', 
                    filters.status === status ? undefined : status
                  )}
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    filters.status === status
                      ? 'bg-green-100 text-green-800 border border-green-200'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 border border-neutral-200'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
