'use client';

/* eslint-disable @typescript-eslint/naming-convention -- composant React (PascalCase) */

import React from 'react';
import Link from 'next/link';
import { TrendingUp, ExternalLink } from 'lucide-react';
import { formatCurrencyEUR } from '@/utils/format';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import type { PatrimoineSnapshotResult } from '@/features/patrimoine/hooks/usePatrimoineSnapshot';

export interface PatrimoineFinancierSectionProps {
  mode: 'normal' | 'app-shell';
  snapshot: PatrimoineSnapshotResult;
  className?: string;
}

const MARKET_APP_HREF = '/app?view=market';

export function PatrimoineFinancierSection({ mode, snapshot, className }: PatrimoineFinancierSectionProps) {
  const reco = snapshot.marketRecommendation;
  const marketLine =
    reco?.message ??
    (snapshot.hasMarketData
      ? 'Données marché à jour — ouvre le module pour ajuster le profil ou valider des actions.'
      : 'Synchronise ou ouvre le module Marché pour alimenter cours, drawdown et suggestions.');

  return (
    <section
      className={cn(
        'space-y-4 rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm sm:p-4',
        className
      )}
      aria-label="Vue financière ETF et marché"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-indigo-600" aria-hidden />
          <div>
            <h2 className="text-sm font-semibold text-slate-900 sm:text-base">Financier (PEA / ETF / Marché)</h2>
            <p className="text-[11px] text-slate-500 sm:text-xs">Données alignées sur le profil Marché sélectionné dans les hypothèses.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 gap-1.5" asChild>
          <Link href={MARKET_APP_HREF} prefetch={false}>
            Ouvrir le module Marché
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </Button>
      </div>

      {mode === 'normal' && (
        <p className="text-[10px] text-slate-500 sm:text-[11px]">
          Raccourci : <span className="font-mono text-slate-700">{MARKET_APP_HREF}</span> (App Shell).
        </p>
      )}

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Profil marché</dt>
          <dd className="mt-1 text-sm font-medium text-slate-900">
            {snapshot.marketProfileSummary ?? '—'}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Cash disponible (cockpit)</dt>
          <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
            {formatCurrencyEUR(snapshot.cashDisponible)}
          </dd>
          <dd className="text-[10px] text-slate-500">Source : {snapshot.sourceCash === 'MARKET' ? 'Marché' : 'Patrimoine'}</dd>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Allocation ETF</dt>
          <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
            {Math.round(Math.max(0, Math.min(1, snapshot.allocationEtf)) * 100)} %
          </dd>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">DCA mensuel (réf.)</dt>
          <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
            {formatCurrencyEUR(snapshot.dcaRecommended)}
          </dd>
          <dd className="text-[10px] text-slate-500">Source : {snapshot.sourceDca === 'MARKET' ? 'Marché' : 'Patrimoine'}</dd>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Jour DCA</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-900">{snapshot.effectiveDcaDayOfMonth}</dd>
          <dd className="text-[10px] text-slate-500">Source : {snapshot.sourceDcaDay === 'MARKET' ? 'Marché' : 'Patrimoine'}</dd>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 sm:col-span-2 lg:col-span-1">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Valorisation ETF / PEA (hypothèse)</dt>
          <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
            {formatCurrencyEUR(snapshot.peaEtfValue)}
          </dd>
        </div>
      </dl>

      <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-800">Recommandation marché</p>
        <p className="mt-1 text-xs leading-snug text-slate-800 sm:text-sm">{marketLine}</p>
        {snapshot.marketScoreLabel && (
          <p className="mt-1 text-[10px] text-slate-600">Score : {snapshot.marketScoreLabel}</p>
        )}
      </div>
    </section>
  );
}
