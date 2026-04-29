'use client';

/* eslint-disable @typescript-eslint/naming-convention -- composant React (PascalCase) */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { History } from 'lucide-react';
import { formatCurrencyEUR } from '@/utils/format';
import { cn } from '@/utils/cn';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { PatrimoineSnapshotResult } from '@/features/patrimoine/hooks/usePatrimoineSnapshot';
import { marketInvestmentStorage } from '@/features/market/services/marketInvestmentStorage';
import type { InvestmentActionLog } from '@/features/market/types';
import {
  aggregatePatrimoineDecisionPerformance,
  computePatrimoineDecisionPerformance,
} from '@/features/patrimoine/services/patrimoineDecisionPerformance';

const MARKET_HISTORY_HREF = '/app?view=market';

export interface PatrimoineDecisionPerformancePanelProps {
  organizationId: string | undefined;
  snapshot: PatrimoineSnapshotResult;
  className?: string;
  /** Résumé court (ex. onglet Synthèse) : pas de liste détaillée. */
  variant?: 'full' | 'compact';
}

function formatPct(ratio: number | null): string {
  if (ratio == null || !Number.isFinite(ratio)) return '—';
  return `${(ratio * 100).toFixed(1)} %`;
}

function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(d);
  } catch {
    return iso;
  }
}

export function PatrimoineDecisionPerformancePanel({
  organizationId,
  snapshot,
  className,
  variant = 'full',
}: PatrimoineDecisionPerformancePanelProps) {
  const [logs, setLogs] = useState<InvestmentActionLog[]>([]);

  const symbol = snapshot.cockpitMarketSymbol;
  const athPeriod = snapshot.cockpitMarketAthPeriod;
  const currentPrice = snapshot.cockpitMarketCurrentPrice;

  useEffect(() => {
    if (!organizationId) {
      setLogs([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const list = await marketInvestmentStorage.listActionLogs(organizationId, 48);
      if (!cancelled) setLogs(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId, snapshot.loading]);

  const priceHistory = useMemo(() => {
    if (!organizationId || !symbol || !athPeriod) return [];
    return marketInvestmentStorage.getPriceHistory(organizationId, symbol, athPeriod);
  }, [organizationId, symbol, athPeriod]);

  const rows = useMemo(
    () =>
      computePatrimoineDecisionPerformance({
        logs,
        priceHistory,
        currentPrice,
        referenceSymbol: symbol,
        limit: 5,
      }),
    [logs, priceHistory, currentPrice, symbol]
  );

  const totals = useMemo(() => aggregatePatrimoineDecisionPerformance(rows), [rows]);

  if (!organizationId || snapshot.loading) {
    return null;
  }

  if (!symbol || !athPeriod) {
    return (
      <div
        className={cn('rounded-xl border border-slate-200/90 bg-slate-50/50 px-3 py-2.5 text-xs text-slate-600', className)}
      >
        <p className="font-medium text-slate-800">Décisions récentes</p>
        <p className="mt-1">Sélectionnez un profil Marché dans les hypothèses pour suivre la performance des décisions.</p>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-[11px] text-slate-700',
          className
        )}
      >
        <div>
          <span className="font-semibold text-slate-800">Décisions récentes :</span>{' '}
          {totals.calculableCount > 0 ? (
            <>
              gain estimé{' '}
              <span className={cn('font-medium tabular-nums', totals.totalGain >= 0 ? 'text-emerald-700' : 'text-red-700')}>
                {formatCurrencyEUR(totals.totalGain)}
              </span>
            </>
          ) : (
            <span className="text-slate-500">—</span>
          )}
        </div>
        <Link href={MARKET_HISTORY_HREF} className="font-medium text-violet-700 underline-offset-2 hover:underline" prefetch={false}>
          Historique marché
        </Link>
      </div>
    );
  }

  return (
    <div
      className={cn('space-y-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm sm:p-4', className)}
      aria-label="Décisions récentes marché"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-violet-600" aria-hidden />
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Décisions récentes</h3>
            <p className="text-[11px] text-slate-500">Dernières validations (profil cockpit), performance indicative.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 gap-1" asChild>
          <Link href={MARKET_HISTORY_HREF} prefetch={false}>
            Voir historique marché
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Total investi (aperçu)</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{formatCurrencyEUR(totals.totalInvested)}</p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Valeur estimée</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
            {totals.calculableCount > 0 ? formatCurrencyEUR(totals.estimatedCurrentValue) : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Gain / perte estimé</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <p
              className={cn(
                'text-sm font-semibold tabular-nums',
                totals.calculableCount === 0
                  ? 'text-slate-500'
                  : totals.totalGain >= 0
                    ? 'text-emerald-700'
                    : 'text-red-700'
              )}
            >
              {totals.calculableCount > 0 ? formatCurrencyEUR(totals.totalGain) : '—'}
            </p>
            {totals.calculableCount > 0 && (
              <Badge variant={totals.totalGain >= 0 ? 'success' : 'danger'} size="sm">
                {totals.totalGain >= 0 ? 'Positif' : 'Négatif'}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
        {rows.length === 0 ? (
          <li className="px-2 py-3 text-xs text-slate-500">Aucune décision validée récente pour ce profil.</li>
        ) : (
          rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-1 px-2 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">
                  {formatShortDate(r.date)} · {r.label}{' '}
                  <span className="font-normal text-slate-500">· {r.etfLabel}</span>
                </p>
                <p className="tabular-nums text-slate-700">
                  {formatCurrencyEUR(r.amount)}
                  {r.priceAtDecision != null && r.priceAtDecision > 0 ? (
                    <span className="text-slate-500">
                      {' '}
                      @ {formatCurrencyEUR(r.priceAtDecision)} →{' '}
                      {currentPrice != null && currentPrice > 0 ? formatCurrencyEUR(currentPrice) : '—'}
                    </span>
                  ) : (
                    <span className="text-slate-500"> · prix décision : —</span>
                  )}
                </p>
              </div>
              <div className="shrink-0 text-right tabular-nums">
                {r.calculable && r.gain != null && r.perfPercent != null ? (
                  <>
                    <p className={cn('font-semibold', r.gain >= 0 ? 'text-emerald-700' : 'text-red-700')}>
                      {formatCurrencyEUR(r.gain)}
                    </p>
                    <p className="text-[10px] text-slate-500">{formatPct(r.perfPercent)}</p>
                  </>
                ) : (
                  <p className="text-slate-500">Non calculable</p>
                )}
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
