'use client';

import { Badge } from '@/components/ui/Badge';
import { computeDrawdownPercent } from '@/features/market/services/marketDecisionService';
import type { MarketRadarEntry } from '@/features/market/hooks/useMarketInvestment';
import type { AthPeriod } from '@/features/market/types';
import { Radar, Info } from 'lucide-react';

interface MarketRadarPanelProps {
  entries: MarketRadarEntry[];
  currency: string;
  lastUpdatedAt?: string | null;
  athPeriod: AthPeriod;
}

function formatCurrency(value: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

function formatActionAmount(value: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

/** Affichage principal : au plus 2 décimales (lisible). */
function formatRadarDrawdownPercentShort(value: number): string {
  return `${new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(value)}%`;
}

/** Tooltip natif : précision fixe 4 décimales pour comparer des ETF très proches. */
function formatRadarDrawdownPercentTitle(value: number): string {
  return `${new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
    useGrouping: false,
  }).format(value)}%`;
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

function drawdownTone(value: number): string {
  if (value <= -20) return 'text-rose-700';
  if (value <= -10) return 'text-amber-700';
  return 'text-emerald-700';
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
  const athLabel = athPeriod === 'MAX' ? 'ATH MAX' : `ATH ${athPeriod}`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-violet-700">
            <Radar className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">Radar ETF World</p>
          <p className="text-xs text-slate-500">Vue d’ensemble des 3 ETF suivis</p>
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
          const snapshot = entry.snapshot;
          // Chaque carte : drawdown recalculé depuis les prix de CE snapshot uniquement (pas d’ETF actif / global).
          const drawdownFromPrices = snapshot
            ? computeDrawdownPercent(snapshot.currentPrice, snapshot.athPrice)
            : 0;
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
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge size="sm" variant={badge.variant}>{badge.label}</Badge>
                </div>
                </div>
              </header>
              {!snapshot ? (
                <p className="mt-2 text-xs text-slate-500">Données indisponibles</p>
              ) : (
                <>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div className="border-r border-slate-100 pr-2">
                      <p className="text-slate-500">Prix</p>
                      <p className="text-[15px] font-semibold text-slate-900">{formatCurrency(snapshot.currentPrice, currency)}</p>
                    </div>
                    <div className="border-r border-slate-100 px-1">
                      <p className="text-slate-500">{athLabel}</p>
                      <p className="text-[15px] font-semibold text-slate-900">{formatCurrency(snapshot.athPrice, currency)}</p>
                    </div>
                    <div className="pl-1">
                      <p className="text-slate-500">Drawdown</p>
                      <p
                        className={`cursor-help text-[15px] font-semibold ${drawdownTone(drawdownFromPrices)}`}
                        title={formatRadarDrawdownPercentTitle(drawdownFromPrices)}
                      >
                        {formatRadarDrawdownPercentShort(drawdownFromPrices)}
                      </p>
                    </div>
                  </div>
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
        <Info className="h-3.5 w-3.5 text-violet-500" />
        <p>Les actions proposées sont des suggestions d’aide à la décision basées sur vos paramètres.</p>
      </div>
    </div>
  );
}
