'use client';

import React from 'react';
import { cn } from '@/utils/cn';
import type { LeasePilotageBucket } from '../utils/leasePilotageSection';
import type { LeasesActionCounts } from '../hooks/useLeasesActionCounts';
import type { ActionFilterKey } from './LeasesActionBanner';

export type PilotageBucketFilterKey = LeasePilotageBucket | null;

const PILOTAGE_ITEMS: Array<{ key: LeasePilotageBucket; label: string; emoji: string }> = [
  { key: 'critique', label: 'À traiter', emoji: '🔴' },
  { key: 'surveiller', label: 'À surveiller', emoji: '🟠' },
  { key: 'ok', label: 'OK', emoji: '🟢' },
  { key: 'ignored', label: 'Ignorés', emoji: '⏸' },
];

export interface LeasesToolbarProps {
  /** Bloc pilotage (priorités) — désactivé en mode normal. */
  showPilotage: boolean;
  pilotageCounts: Record<LeasePilotageBucket, number>;
  pilotageActive: PilotageBucketFilterKey;
  onPilotageChange: (key: PilotageBucketFilterKey) => void;

  actionCounts: LeasesActionCounts;
  actionActive: ActionFilterKey;
  onActionFilterChange: (key: ActionFilterKey) => void;

  disabled?: boolean;
}

const ACTION_ITEMS: Array<{ key: ActionFilterKey; label: string }> = [
  { key: 'retards', label: 'Retards' },
  { key: 'partiels', label: 'Partiels' },
  { key: 'expirant90', label: 'Échéance < 90 j' },
  { key: 'indexations', label: 'Indexations' },
];

/** h-8 + flex pour alignement vertical type SaaS */
const pilotageBtnBase =
  'h-8 inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border-2 px-3 text-xs font-semibold leading-none transition-all';

const filterBtnBase =
  'h-8 inline-flex shrink-0 items-center justify-center rounded-lg border px-2.5 text-xs font-medium leading-none transition-colors';

export function LeasesToolbar({
  showPilotage,
  pilotageCounts,
  pilotageActive,
  onPilotageChange,
  actionCounts,
  actionActive,
  onActionFilterChange,
  disabled,
}: LeasesToolbarProps) {
  return (
    <div
      className={cn(
        'mb-3 flex flex-wrap items-center gap-y-4 border-b border-slate-100/90 py-3 text-sm',
        showPilotage ? 'gap-x-6 sm:gap-x-8' : 'gap-x-3'
      )}
    >
      {showPilotage && (
        <>
          <div className="flex min-w-0 flex-[1_1_auto] flex-wrap items-center gap-x-3 gap-y-2">
            <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-slate-800">
              Pilotage
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={disabled}
                title="Afficher tous les baux (sans filtre de pilotage)"
                onClick={() => onPilotageChange(null)}
                className={cn(
                  pilotageBtnBase,
                  'shadow-sm',
                  pilotageActive === null
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200/90 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                )}
              >
                Tous
              </button>
              {PILOTAGE_ITEMS.map(({ key, label, emoji }) => {
                const n = pilotageCounts[key];
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={disabled || n === 0}
                    onClick={() => onPilotageChange(pilotageActive === key ? null : key)}
                    className={cn(
                      pilotageBtnBase,
                      'shadow-sm',
                      pilotageActive === key
                        ? 'border-orange-600 bg-orange-500 text-white ring-2 ring-orange-200/80'
                        : 'border-slate-200/90 bg-gradient-to-b from-white to-slate-50/90 text-slate-800 hover:border-orange-200/80 hover:to-orange-50/40',
                      n === 0 && 'cursor-not-allowed shadow-none opacity-40'
                    )}
                  >
                    <span aria-hidden>{emoji}</span>
                    <span>{label}</span>
                    <span
                      className={cn(
                        'tabular-nums',
                        pilotageActive === key ? 'opacity-95' : 'text-slate-600'
                      )}
                    >
                      ({n})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className="hidden h-8 w-px shrink-0 bg-slate-200 sm:block"
            aria-hidden
          />
          <div className="h-px w-full shrink-0 bg-slate-200/95 sm:hidden" aria-hidden />
        </>
      )}

      <div
        className={cn(
          'flex min-w-0 flex-[1_1_auto] flex-wrap items-center gap-x-3 gap-y-2',
          !showPilotage && 'w-full'
        )}
      >
        <span className="shrink-0 text-xs font-medium text-slate-600">Filtres</span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            title="Réinitialiser les filtres retard, partiel, échéance, indexation"
            onClick={() => onActionFilterChange(null)}
            className={cn(
              filterBtnBase,
              actionActive === null
                ? 'border-slate-800 bg-slate-800 text-white'
                : 'border-slate-200 bg-slate-50/90 text-slate-600 hover:border-slate-300 hover:bg-slate-100/80'
            )}
          >
            Tous filtres
          </button>
          {ACTION_ITEMS.map(({ key, label }) => {
            const n =
              key === 'retards'
                ? actionCounts.retards
                : key === 'partiels'
                  ? actionCounts.partiels
                  : key === 'expirant90'
                    ? actionCounts.expirant90
                    : actionCounts.indexations;
            return (
              <button
                key={key || 'x'}
                type="button"
                disabled={disabled || n === 0}
                onClick={() => onActionFilterChange(actionActive === key ? null : key)}
                className={cn(
                  filterBtnBase,
                  actionActive === key
                    ? 'border-slate-800 bg-white text-slate-900 shadow-sm ring-1 ring-slate-800/90'
                    : 'border-slate-200/90 bg-transparent text-slate-600 hover:border-slate-300 hover:bg-slate-50/70',
                  n === 0 && 'cursor-not-allowed opacity-40'
                )}
              >
                {label}{' '}
                <span className="tabular-nums">({n})</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
