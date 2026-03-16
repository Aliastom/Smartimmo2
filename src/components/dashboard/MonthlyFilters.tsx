'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface MonthlyFiltersProps {
  month: string; // Format: YYYY-MM
  /** Afficher le sélecteur de mois (prévu pour être affiché séparément en haut de page) */
  showMonthSelector?: boolean;
  bienIds: string[];
  locataireIds: string[];
  type: 'INCOME' | 'EXPENSE' | 'ALL';
  statut: 'paye' | 'en_retard' | 'a_venir' | 'ALL';
  source: 'loyer' | 'hors_loyer' | 'ALL';
  focusLoyer?: boolean;
  onFilterChange: (filters: {
    month?: string;
    bienIds?: string[];
    locataireIds?: string[];
    type?: 'INCOME' | 'EXPENSE' | 'ALL';
    statut?: 'paye' | 'en_retard' | 'a_venir' | 'ALL';
    source?: 'loyer' | 'hors_loyer' | 'ALL';
    focusLoyer?: boolean;
  }) => void;
  biens?: Array<{ id: string; name: string }>;
  locataires?: Array<{ id: string; firstName: string; lastName: string }>;
}

export function MonthlyFilters({
  month,
  showMonthSelector = true,
  bienIds,
  locataireIds,
  type,
  statut,
  source,
  focusLoyer = false,
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
      focusLoyer: false,
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
    <div className={cn(
      'bg-white rounded-xl border border-gray-200',
      showMonthSelector ? 'p-4 space-y-4' : 'px-3 py-2 space-y-2'
    )}>
      {/* Sélecteur de mois (optionnel, pour affichage en bas ou tout-en-un) */}
      {showMonthSelector && (
        <div className="flex items-center justify-between gap-2 md:gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-shrink-0">
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

          <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="whitespace-nowrap text-[10px] md:text-sm px-1.5 py-1 md:px-3 md:py-2 h-7 md:h-9"
            >
              <span className="hidden md:inline">{showAdvanced ? 'Masquer filtres' : 'Filtres avancés'}</span>
              <span className="md:hidden text-[10px]">{showAdvanced ? 'Masq.' : 'Filtres'}</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="whitespace-nowrap text-[10px] md:text-sm px-1.5 py-1 md:px-3 md:py-2 h-7 md:h-9"
            >
              <RotateCcw className="h-3 w-3 md:h-4 md:w-4 mr-0.5 md:mr-2" />
              <span className="md:hidden text-[10px]">Reset</span>
              <span className="hidden md:inline">Réinitialiser</span>
            </Button>
          </div>
        </div>
      )}

      {/* Toolbar compacte : Filtres (quand pas de sélecteur de mois) */}
      {!showMonthSelector && (
        <div className="flex flex-wrap items-center gap-2 py-1">
          <span className="text-xs font-medium text-slate-500 mr-1">Filtres :</span>
          <div className="flex flex-wrap items-center gap-1">
            <div className="flex gap-0.5 bg-slate-100 rounded-md p-0.5">
              {[
                { value: 'ALL' as const, label: 'Tous' },
                { value: 'INCOME' as const, label: 'Recettes' },
                { value: 'EXPENSE' as const, label: 'Dépenses' },
              ].map((o) => (
                <button
                  key={o.value}
                  onClick={() => onFilterChange({ type: o.value })}
                  className={cn(
                    'px-2.5 py-1 text-xs font-medium rounded transition-colors',
                    type === o.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <span className="text-slate-300 mx-0.5" aria-hidden>|</span>
            <div className="flex gap-0.5 bg-slate-100 rounded-md p-0.5">
              {[
                { value: 'ALL' as const, label: 'Tous' },
                { value: 'paye' as const, label: 'Payé' },
                { value: 'en_retard' as const, label: 'Retard' },
                { value: 'a_venir' as const, label: 'À venir' },
              ].map((o) => (
                <button
                  key={o.value}
                  onClick={() => onFilterChange({ statut: o.value })}
                  className={cn(
                    'px-2.5 py-1 text-xs font-medium rounded transition-colors',
                    statut === o.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <span className="text-slate-300 mx-0.5" aria-hidden>|</span>
            <div className="flex gap-0.5 bg-slate-100 rounded-md p-0.5">
              {[
                { value: 'ALL' as const, label: 'Tous' },
                { value: 'loyer' as const, label: 'Loyers' },
                { value: 'hors_loyer' as const, label: 'Hors loyers' },
              ].map((o) => (
                <button
                  key={o.value}
                  onClick={() => onFilterChange({ source: o.value })}
                  className={cn(
                    'px-2.5 py-1 text-xs font-medium rounded transition-colors',
                    source === o.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="ml-1 h-7 px-2 text-xs"
            >
              {showAdvanced ? 'Masquer' : 'Avancés'}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 px-2 text-xs">
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          </div>
        </div>
      )}
      {/* Filtres en blocs (avec sélecteur de mois) */}
      {showMonthSelector && (
      <div className="flex flex-wrap gap-6">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Type</p>
          <div className="flex gap-1 bg-gray-50 rounded-lg p-1">
            {[
              { value: 'ALL' as const, label: 'Tous' },
              { value: 'INCOME' as const, label: 'Recettes' },
              { value: 'EXPENSE' as const, label: 'Dépenses' },
            ].map((o) => (
              <button
                key={o.value}
                onClick={() => onFilterChange({ type: o.value })}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  type === o.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Statut</p>
          <div className="flex gap-1 bg-gray-50 rounded-lg p-1">
            {[
              { value: 'ALL' as const, label: 'Tous' },
              { value: 'paye' as const, label: 'Payé' },
              { value: 'en_retard' as const, label: 'Retard' },
              { value: 'a_venir' as const, label: 'À venir' },
            ].map((o) => (
              <button
                key={o.value}
                onClick={() => onFilterChange({ statut: o.value })}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  statut === o.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Catégorie</p>
          <div className="flex gap-1 bg-gray-50 rounded-lg p-1">
            {[
              { value: 'ALL' as const, label: 'Tous' },
              { value: 'loyer' as const, label: 'Loyers' },
              { value: 'hors_loyer' as const, label: 'Hors loyers' },
            ].map((o) => (
              <button
                key={o.value}
                onClick={() => onFilterChange({ source: o.value })}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  source === o.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* Filtres avancés (multi-select + Focus loyer) */}
      {showAdvanced && (
        <div className="space-y-4 pt-4 border-t border-gray-200">
          {/* Focus loyer */}
          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-slate-50 p-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Focus loyer</p>
              <p className="text-xs text-gray-500">
                Afficher uniquement les transactions de gestion déléguée (loyers et frais de gestion)
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={focusLoyer}
                onChange={(e) => onFilterChange({ focusLoyer: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
              <span className="ml-2 text-sm text-gray-700">{focusLoyer ? 'Activé' : 'Désactivé'}</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Multi-select Biens */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Biens
            </label>
            <div className="border border-gray-300 rounded-md p-3 max-h-48 overflow-y-auto bg-white">
              {biens.length === 0 ? (
                <p className="text-gray-500 text-sm">Aucun bien disponible</p>
              ) : (
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 hover:bg-gray-50 p-1 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bienIds.length === 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          onFilterChange({ bienIds: [] });
                        }
                      }}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">Tous les biens</span>
                  </label>
                  {biens.map((bien) => (
                    <label
                      key={bien.id}
                      className="flex items-center space-x-2 hover:bg-gray-50 p-1 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={bienIds.includes(bien.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            onFilterChange({ bienIds: [...bienIds, bien.id] });
                          } else {
                            onFilterChange({ bienIds: bienIds.filter((id) => id !== bien.id) });
                          }
                        }}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">{bien.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Multi-select Locataires */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Locataires
            </label>
            <div className="border border-gray-300 rounded-md p-3 max-h-48 overflow-y-auto bg-white">
              {locataires.length === 0 ? (
                <p className="text-gray-500 text-sm">Aucun locataire disponible</p>
              ) : (
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 hover:bg-gray-50 p-1 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={locataireIds.length === 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          onFilterChange({ locataireIds: [] });
                        }
                      }}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">Tous les locataires</span>
                  </label>
                  {locataires.map((locataire) => (
                    <label
                      key={locataire.id}
                      className="flex items-center space-x-2 hover:bg-gray-50 p-1 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={locataireIds.includes(locataire.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            onFilterChange({ locataireIds: [...locataireIds, locataire.id] });
                          } else {
                            onFilterChange({ locataireIds: locataireIds.filter((id) => id !== locataire.id) });
                          }
                        }}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">
                        {locataire.firstName} {locataire.lastName}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}

