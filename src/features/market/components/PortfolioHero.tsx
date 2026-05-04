'use client';

import { cn } from '@/utils/cn';
import type { usePortfolioTracker } from '@/features/market/hooks/usePortfolioTracker';

type Totals = ReturnType<typeof usePortfolioTracker>['totals'];

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

function formatPct(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)} %`;
}

export interface PortfolioHeroProps {
  totals: Totals;
  currency: string;
  loading?: boolean;
  /** Récap discret : comptes portefeuille + positions ouvertes (affichage uniquement). */
  accountCount?: number;
  openPositionLineCount?: number;
}

/**
 * Ratio d’affichage uniquement : performance brute ÷ coût restant investi × 100.
 * Indicateur simplifié (pas un TRI ni une perf annualisée).
 */
function grossPerformancePct(totals: Totals): number | null {
  const basis = totals.totalRemainingCostBasis;
  if (basis <= 0 && totals.grossPerformanceEuro === 0) return 0;
  if (basis <= 0) return null;
  return (totals.grossPerformanceEuro / basis) * 100;
}

type PerfTone = 'gain' | 'loss' | 'neutral';

function perfTone(gross: number): PerfTone {
  if (gross > 0) return 'gain';
  if (gross < 0) return 'loss';
  return 'neutral';
}

const toneEuroPct = {
  gain: 'text-emerald-700',
  loss: 'text-rose-700',
  neutral: 'text-slate-700',
} as const;

export function PortfolioHero({ totals, currency, loading, accountCount, openPositionLineCount }: PortfolioHeroProps) {
  const pct = grossPerformancePct(totals);
  const gross = totals.grossPerformanceEuro;
  const tone = perfTone(gross);
  const toneCls = toneEuroPct[tone];

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm md:p-8">
        <div className="h-10 w-56 max-w-full animate-pulse rounded-lg bg-slate-100" />
        <div className="mt-4 h-8 w-40 max-w-full animate-pulse rounded-lg bg-slate-100" />
        <div className="mt-6 h-5 w-72 max-w-full animate-pulse rounded bg-slate-50" />
      </div>
    );
  }

  const mvZero = totals.totalMarketValue === 0 && totals.totalRemainingCostBasis === 0 && gross === 0;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/90 p-6 shadow-md md:p-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Valeur totale du portefeuille</p>
      {typeof accountCount === 'number' && typeof openPositionLineCount === 'number' ? (
        <p className="mt-1 text-[11px] text-slate-500">
          {accountCount} {accountCount > 1 ? 'comptes' : 'compte'} portefeuille · {openPositionLineCount}{' '}
          {openPositionLineCount > 1 ? 'positions ouvertes' : 'position ouverte'}
        </p>
      ) : null}
      <p
        className={cn(
          'mt-2 min-w-0 break-words text-3xl font-bold tabular-nums tracking-tight md:text-4xl',
          mvZero ? 'text-slate-600' : 'text-slate-900',
        )}
      >
        {formatCurrency(totals.totalMarketValue, currency)}
      </p>
      {mvZero ? (
        <p className="mt-2 text-sm text-slate-500">Ajoutez un compte et des ordres pour afficher la valorisation.</p>
      ) : null}

      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">Performance totale (estim.)</p>
      <div className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className={cn('text-xl font-semibold tabular-nums md:text-2xl', toneCls)} aria-live="polite">
          {formatCurrency(gross, currency)}
        </p>
        {pct != null && (
          <>
            <span className={cn('text-base font-semibold tabular-nums md:text-lg', toneCls)} aria-hidden>
              ({formatPct(pct)})
            </span>
            <span className="sr-only">{`Performance brute sur coût restant investi, indicateur d'affichage : ${formatPct(pct)}`}</span>
          </>
        )}
        {pct == null && gross !== 0 && (
          <span className="text-sm text-slate-600">— % non calculé (coût restant nul)</span>
        )}
      </div>
      <p className="mt-2 max-w-prose text-[11px] leading-snug text-slate-500">
        Pourcentage affiché :{' '}
        <span className="font-medium text-slate-600">performance brute ÷ coût restant investi</span> (indicateur simple,
        pas un TRI).
      </p>

      <p className="mt-4 text-sm text-slate-600">
        Investi :{' '}
        <span className="font-semibold tabular-nums text-slate-800">{formatCurrency(totals.totalRemainingCostBasis, currency)}</span>
        <span className="mx-2 text-slate-300" aria-hidden>
          •
        </span>
        Dividendes :{' '}
        <span className="font-semibold tabular-nums text-slate-800">{formatCurrency(totals.totalDividendsNet, currency)}</span>
      </p>
    </div>
  );
}
