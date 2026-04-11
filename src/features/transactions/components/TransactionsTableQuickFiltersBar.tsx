'use client';

import React from 'react';
import { cn } from '@/utils/cn';

export interface TransactionsTableQuickFiltersBarProps {
  nonRapprochees: number;
  sansDocument: number;
  isLoading?: boolean;
  kpiNonRapprocheesActive: boolean;
  sansDocumentFilterActive: boolean;
  onToggleNonRapprochees: () => void;
  onToggleSansDocument: () => void;
}

/** Toolbar légère : raccourcis sur le tableau uniquement (pas un bloc de pilotage). */
export function TransactionsTableQuickFiltersBar({
  nonRapprochees,
  sansDocument,
  isLoading = false,
  kpiNonRapprocheesActive,
  sansDocumentFilterActive,
  onToggleNonRapprochees,
  onToggleSansDocument,
}: TransactionsTableQuickFiltersBarProps) {
  const bothEmpty = nonRapprochees === 0 && sansDocument === 0;

  const chipBase =
    'px-3 py-1.5 text-xs font-medium rounded-md transition-colors border focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1';

  if (isLoading) {
    return (
      <div
        className="inline-flex flex-wrap items-center gap-2"
        aria-busy="true"
        aria-label="Chargement des filtres tableau"
      >
        <div className="h-7 w-28 bg-gray-100 rounded-md animate-pulse border border-transparent" />
        <div className="h-7 w-24 bg-gray-100 rounded-md animate-pulse border border-transparent" />
      </div>
    );
  }

  return (
    <div
      className="inline-flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Filtres rapides sur les lignes du tableau"
    >
      <button
        type="button"
        onClick={onToggleNonRapprochees}
        disabled={nonRapprochees === 0}
        aria-pressed={kpiNonRapprocheesActive}
        title="Réduire le tableau aux non rapprochées (même décompte que la carte KPI, lecture des volumes)"
        className={cn(
          chipBase,
          'inline-flex items-center gap-1.5',
          nonRapprochees === 0 && 'opacity-45 cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400',
          nonRapprochees > 0 &&
            !kpiNonRapprocheesActive &&
            'cursor-pointer bg-white border-gray-300 text-gray-700 hover:bg-gray-50',
          nonRapprochees > 0 &&
            kpiNonRapprocheesActive &&
            'cursor-pointer bg-orange-100 text-orange-700 border-orange-300'
        )}
      >
        <span>Non rapprochées</span>
        <span className="tabular-nums text-[11px] opacity-90">{nonRapprochees}</span>
      </button>

      <button
        type="button"
        onClick={onToggleSansDocument}
        disabled={sansDocument === 0}
        aria-pressed={sansDocumentFilterActive}
        title="Réduire le tableau aux transactions sans document joint"
        className={cn(
          chipBase,
          'inline-flex items-center gap-1.5',
          sansDocument === 0 && 'opacity-45 cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400',
          sansDocument > 0 &&
            !sansDocumentFilterActive &&
            'cursor-pointer bg-white border-gray-300 text-gray-700 hover:bg-gray-50',
          sansDocument > 0 &&
            sansDocumentFilterActive &&
            'cursor-pointer bg-orange-100 text-orange-700 border-orange-300'
        )}
      >
        <span>Sans document</span>
        <span className="tabular-nums text-[11px] opacity-90">{sansDocument}</span>
      </button>

      {bothEmpty && (
        <span className="text-xs text-gray-400">—</span>
      )}
    </div>
  );
}
