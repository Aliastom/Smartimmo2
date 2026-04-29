'use client';

/* eslint-disable @typescript-eslint/naming-convention -- composant React (PascalCase) */

import React from 'react';
import { cn } from '@/utils/cn';
import type { PatrimoineSnapshotResult } from '@/features/patrimoine/hooks/usePatrimoineSnapshot';

export interface PatrimoineGlobalBadgesProps {
  snapshot: PatrimoineSnapshotResult;
  className?: string;
}

/** Une seule rangée de statuts sources (fiscal, marché, hypothèses). */
export function PatrimoineGlobalBadges({ snapshot, className }: PatrimoineGlobalBadgesProps) {
  const fiscal = snapshot.hasFiscalSimulation
    ? snapshot.fiscalYear != null
      ? `Liée (${snapshot.fiscalYear})`
      : 'Liée'
    : 'Non reliée';
  const market = snapshot.hasMarketData ? 'Disponibles' : 'Non disponibles';

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2.5 pt-0.5 text-[11px] sm:text-xs',
        className
      )}
      aria-label="État des sources de données"
    >
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-1 font-medium ring-1',
          snapshot.hasFiscalSimulation
            ? 'bg-emerald-50 text-emerald-900 ring-emerald-200/80'
            : 'bg-amber-50 text-amber-950 ring-amber-200/70'
        )}
      >
        Simulation fiscale : {fiscal}
      </span>
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-1 font-medium ring-1',
          snapshot.hasMarketData
            ? 'bg-indigo-50 text-indigo-950 ring-indigo-200/70'
            : 'bg-slate-100 text-slate-700 ring-slate-200/90'
        )}
      >
        Données marché : {market}
      </span>
      <span className="inline-flex items-center rounded-full bg-slate-900/5 px-2.5 py-1 font-medium text-slate-800 ring-1 ring-slate-200/80">
        Hypothèses : sauvegardées
      </span>
    </div>
  );
}
