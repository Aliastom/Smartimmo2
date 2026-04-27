'use client';

import { Badge } from '@/components/ui/Badge';
import type { MarketRadarEntry } from '@/features/market/hooks/useMarketInvestment';
import type { AthPeriod } from '@/features/market/types';
import { Radar, Info } from 'lucide-react';

interface MarketRadarPanelProps {
  entries: MarketRadarEntry[];
  currency: string;
  lastUpdatedAt?: string | null;
  athPeriod: AthPeriod;
}

function formatActionAmount(value: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

function formatPriceCurrent(value: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
}

function computeDrawdownShort(currentPrice: number, athPrice: number): number {
  if (!Number.isFinite(currentPrice) || !Number.isFinite(athPrice) || athPrice <= 0) return 0;
  return ((currentPrice - athPrice) / athPrice) * 100;
}

function formatDrawdownShort(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} %`;
}

function drawdownShortTone(value: number): string {
  if (value <= -10) return 'text-rose-700';
  if (value <= -5) return 'text-amber-700';
  if (value <= -2) return 'text-orange-700';
  if (value < 0) return 'text-amber-700';
  return 'text-emerald-700';
}

function drawdownShortChipTone(value: number): string {
  if (value <= -10) return 'border-rose-200 bg-rose-100 text-rose-800';
  if (value <= -5) return 'border-amber-200 bg-amber-100 text-amber-800';
  if (value <= -2) return 'border-orange-200 bg-orange-100 text-orange-800';
  if (value < 0) return 'border-amber-200 bg-amber-100 text-amber-800';
  return 'border-emerald-200 bg-emerald-100 text-emerald-800';
}

function actionMainLine(entry: MarketRadarEntry, currency: string): string {
  if (!entry.recommendation) return 'Données indisponibles';
  const rec = entry.recommendation;
  if (rec.decisionType === 'DCA_ONLY') {
    return `Action : Investissement mensuel (DCA ${formatActionAmount(rec.monthlyDcaPortion, currency)})`;
  }
  return `Action : DCA + renfort (${formatActionAmount(rec.suggestedAmount, currency)})`;
}

function badgeForStatus(status: MarketRadarEntry['recommendation'] extends infer R ? R : never) {
  if (!status) return { label: 'Indisponible', variant: 'gray' as const };
  if (status.status === 'FORTE_OPPORTUNITE') return { label: 'FORTE OPPORTUNITÉ', variant: 'danger' as const };
  if (status.status === 'OPPORTUNITE') return { label: 'OPPORTUNITÉ', variant: 'warning' as const };
  return { label: 'NORMAL', variant: 'success' as const };
}

function cardTone(status: MarketRadarEntry['recommendation']) {
  if (!status) return 'border-slate-200 bg-white';
  if (status.status === 'FORTE_OPPORTUNITE') return 'border-rose-200 bg-white';
  if (status.status === 'OPPORTUNITE') return 'border-amber-200 bg-white';
  return 'border-emerald-200 bg-white';
}

function headerTone(status: MarketRadarEntry['recommendation']): string {
  if (!status) return 'border-slate-200';
  if (status.status === 'FORTE_OPPORTUNITE') return 'border-rose-200';
  if (status.status === 'OPPORTUNITE') return 'border-amber-200';
  return 'border-emerald-200';
}

function headerToneStyle(status: MarketRadarEntry['recommendation']): { backgroundColor: string } {
  if (!status) return { backgroundColor: '#f8fafc' };
  if (status.status === 'FORTE_OPPORTUNITE') return { backgroundColor: '#ffe4e6' };
  if (status.status === 'OPPORTUNITE') return { backgroundColor: '#fef3c7' };
  return { backgroundColor: '#dcfce7' };
}

function actionTone(status: MarketRadarEntry['recommendation']): string {
  if (!status) return 'text-slate-600';
  if (status.status === 'FORTE_OPPORTUNITE') return 'text-rose-700';
  if (status.status === 'OPPORTUNITE') return 'text-amber-700';
  return 'text-emerald-700';
}

function actionBoxTone(status: MarketRadarEntry['recommendation']): string {
  if (!status) return 'border-slate-200 bg-slate-50';
  if (status.status === 'FORTE_OPPORTUNITE') return 'border-rose-200 bg-rose-50/55';
  if (status.status === 'OPPORTUNITE') return 'border-amber-200 bg-amber-50/55';
  return 'border-emerald-200 bg-emerald-50/55';
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- composant React (PascalCase)
export function MarketRadarPanel({ entries, currency, lastUpdatedAt = null, athPeriod }: MarketRadarPanelProps) {
  if (entries.length === 0) return null;
  const hasOpportunity = entries.some(
    (entry) => entry.recommendation && (entry.recommendation.status === 'OPPORTUNITE' || entry.recommendation.status === 'FORTE_OPPORTUNITE')
  );
  const athColumnLabel =
    athPeriod === 'MAX' ? 'ATH MAX' : athPeriod === '5Y' ? 'ATH 5Y' : athPeriod === '10Y' ? 'ATH 10Y' : `ATH ${athPeriod}`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-violet-700">
            <Radar className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">Radar marché — actifs surveillés</p>
          <p className="text-xs text-slate-500">Vue d’ensemble de la liste courte des actifs surveillés</p>
          <p className="mt-0.5 text-[11px] font-medium text-slate-600">Période globale : {athColumnLabel}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">{lastUpdatedAt ? `MAJ : ${new Date(lastUpdatedAt).toLocaleString('fr-FR')}` : 'MAJ : —'}</p>
          {!hasOpportunity && (
            <p className="text-xs text-slate-500">Marché proche des plus hauts — aucune opportunité de renfort détectée.</p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {entries.map((entry) => {
          const badge = badgeForStatus(entry.recommendation);
          const shortDrawdown = entry.snapshot
            ? computeDrawdownShort(entry.snapshot.currentPrice, entry.snapshot.athPrice)
            : null;
          return (
            <article key={entry.symbol} className={`rounded-xl border p-3 shadow-sm ${cardTone(entry.recommendation)}`}>
              <header
                className={`-mx-3 -mt-3 mb-2 rounded-t-xl border-b px-3 py-2 ${headerTone(entry.recommendation)}`}
                style={headerToneStyle(entry.recommendation)}
              >
                <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-base font-bold leading-5 text-slate-900">{entry.symbol}</p>
                  <p className="text-xs text-slate-600">{entry.label}</p>
                  {entry.snapshot && (
                    <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                      Prix actuel : {formatPriceCurrent(entry.snapshot.currentPrice, currency)}
                    </p>
                  )}
                  {shortDrawdown !== null && (
                    <p
                      className={`mt-1 inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold tabular-nums ${drawdownShortChipTone(shortDrawdown)} ${drawdownShortTone(shortDrawdown)}`}
                    >
                        ↓ {formatDrawdownShort(shortDrawdown)} du sommet
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge size="sm" variant={badge.variant}>{badge.label}</Badge>
                </div>
                </div>
              </header>
              {!entry.snapshot ? (
                <p className="mt-2 text-xs text-slate-500">Données indisponibles</p>
              ) : (
                <>
                  <footer className={`mt-3 rounded-lg border px-3 py-2 text-center ${actionBoxTone(entry.recommendation)}`}>
                    <p className={`text-sm font-semibold ${actionTone(entry.recommendation)}`}>
                      {entry.recommendation?.status === 'NORMAL' ? '✅ ' : entry.recommendation?.status === 'FORTE_OPPORTUNITE' ? '🔴 ' : '⚠️ '}
                      {actionMainLine(entry, currency)}
                    </p>
                    {entry.recommendation?.decisionType === 'DCA_ONLY' && (
                      <p className="mt-1 text-[11px] leading-snug text-slate-500">
                        Stratégie principale recommandée à long terme
                      </p>
                    )}
                  </footer>
                </>
              )}
            </article>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <Info className="h-3.5 w-3.5 shrink-0 text-violet-500" />
        <p>
          Historique des décisions pris en compte (même logique que l’actif principal). Indicatif — aucun ordre bancaire.
        </p>
      </div>
    </div>
  );
}
