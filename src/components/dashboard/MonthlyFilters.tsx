'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface MonthlyFiltersProps {
  month: string; // Format: YYYY-MM
  bienIds: string[];
  locataireIds: string[];
  type: 'INCOME' | 'EXPENSE' | 'ALL';
  statut: 'paye' | 'en_retard' | 'a_venir' | 'ALL';
  source: 'loyer' | 'hors_loyer' | 'ALL';
  onFilterChange: (filters: {
    month?: string;
    bienIds?: string[];
    locataireIds?: string[];
    type?: 'INCOME' | 'EXPENSE' | 'ALL';
    statut?: 'paye' | 'en_retard' | 'a_venir' | 'ALL';
    source?: 'loyer' | 'hors_loyer' | 'ALL';
  }) => void;
  biens?: Array<{ id: string; name: string }>;
  locataires?: Array<{ id: string; firstName: string; lastName: string }>;
}

export function MonthlyFilters({
  month,
  bienIds,
  locataireIds,
  type,
  statut,
  source,
  onFilterChange,
  biens = [],
  locataires = [],
}: MonthlyFiltersProps) {
  const [localMonth, setLocalMonth] = useState(month);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    setLocalMonth(month);
  }, [month]);

  const handlePrevMonth = () => {
    const [year, monthNum] = localMonth.split('-').map(Number);
    const prevDate = new Date(year, monthNum - 2, 1);
    const newMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    setLocalMonth(newMonth);
    onFilterChange({ month: newMonth });
  };

  const handleNextMonth = () => {
    const [year, monthNum] = localMonth.split('-').map(Number);
    const nextDate = new Date(year, monthNum, 1);
    const newMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    setLocalMonth(newMonth);
    onFilterChange({ month: newMonth });
  };

  const handleReset = () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setLocalMonth(currentMonth);
    onFilterChange({
      month: currentMonth,
      bienIds: [],
      locataireIds: [],
      type: 'ALL',
      statut: 'ALL',
      source: 'ALL',
    });
  };

  const formatMonth = (monthStr: string) => {
    const [year, monthNum] = monthStr.split('-');
    const date = new Date(Number(year), Number(monthNum) - 1, 1);
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  };

  const isCurrentMonth = () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return localMonth === currentMonth;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      {/* Sélecteur de mois */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevMonth}
            aria-label="Mois précédent"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="min-w-[200px] text-center">
            <h3 className="text-lg font-semibold text-gray-900 capitalize">
              {formatMonth(localMonth)}
            </h3>
            {!isCurrentMonth() && (
              <p className="text-xs text-gray-500">
                (Mois sélectionné)
              </p>
            )}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextMonth}
            aria-label="Mois suivant"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? 'Masquer filtres' : 'Filtres avancés'}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Réinitialiser
          </Button>
        </div>
      </div>

      {/* Filtres rapides */}
      <div className="flex flex-wrap gap-2">
        {/* Filtre Type */}
        <div className="flex gap-1 bg-gray-50 rounded-lg p-1">
          <button
            onClick={() => onFilterChange({ type: 'ALL' })}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              type === 'ALL'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Tous
          </button>
          <button
            onClick={() => onFilterChange({ type: 'INCOME' })}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              type === 'INCOME'
                ? 'bg-white text-green-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Recettes
          </button>
          <button
            onClick={() => onFilterChange({ type: 'EXPENSE' })}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              type === 'EXPENSE'
                ? 'bg-white text-red-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Dépenses
          </button>
        </div>

        {/* Filtre Statut */}
        <div className="flex gap-1 bg-gray-50 rounded-lg p-1">
          <button
            onClick={() => onFilterChange({ statut: 'ALL' })}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              statut === 'ALL'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Tous
          </button>
          <button
            onClick={() => onFilterChange({ statut: 'paye' })}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              statut === 'paye'
                ? 'bg-white text-green-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Payés
          </button>
          <button
            onClick={() => onFilterChange({ statut: 'en_retard' })}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              statut === 'en_retard'
                ? 'bg-white text-red-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            En retard
          </button>
          <button
            onClick={() => onFilterChange({ statut: 'a_venir' })}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              statut === 'a_venir'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            À venir
          </button>
        </div>

        {/* Filtre Source */}
        <div className="flex gap-1 bg-gray-50 rounded-lg p-1">
          <button
            onClick={() => onFilterChange({ source: 'ALL' })}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              source === 'ALL'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Tout
          </button>
          <button
            onClick={() => onFilterChange({ source: 'loyer' })}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              source === 'loyer'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Loyers
          </button>
          <button
            onClick={() => onFilterChange({ source: 'hors_loyer' })}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              source === 'hors_loyer'
                ? 'bg-white text-gray-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Hors loyers
          </button>
        </div>
      </div>

      {/* Filtres avancés (multi-select) */}
      {showAdvanced && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
          {/* TODO: Implémenter multi-select pour biens et locataires */}
          <div className="text-sm text-gray-500">
            Filtres avancés Biens/Locataires à implémenter avec composant multi-select
          </div>
        </div>
      )}
    </div>
  );
}

