'use client';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { MarketRadarEntry } from '@/features/market/hooks/useMarketInvestment';

interface MarketRadarPanelProps {
  entries: MarketRadarEntry[];
  currency: string;
  compact?: boolean;
  lastUpdatedAt?: string | null;
  onFollowEtf?: (symbol: string) => void;
}

function formatCurrency(value: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function actionLabel(entry: MarketRadarEntry, currency: string): string {
  if (!entry.recommendation) return 'Données indisponibles';
  if (entry.recommendation.status === 'NORMAL') return 'Rien à faire';
  if (entry.recommendation.status === 'FORTE_OPPORTUNITE') {
    return `Renfort fort suggéré : ${formatCurrency(entry.recommendation.suggestedAmount, currency)}`;
  }
  return `Renfort suggéré : ${formatCurrency(entry.recommendation.suggestedAmount, currency)}`;
}

function badgeForStatus(status: MarketRadarEntry['recommendation'] extends infer R ? R : never) {
  if (!status) return { label: 'Indisponible', variant: 'gray' as const };
  if (status.status === 'FORTE_OPPORTUNITE') return { label: 'FORTE OPPORTUNITÉ', variant: 'danger' as const };
  if (status.status === 'OPPORTUNITE') return { label: 'OPPORTUNITÉ', variant: 'warning' as const };
  return { label: 'NORMAL', variant: 'secondary' as const };
}

export function MarketRadarPanel({ entries, currency, compact = false, lastUpdatedAt = null, onFollowEtf }: MarketRadarPanelProps) {
  if (entries.length === 0) return null;
  const hasOpportunity = entries.some(
    (entry) => entry.recommendation && (entry.recommendation.status === 'OPPORTUNITE' || entry.recommendation.status === 'FORTE_OPPORTUNITE')
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Radar ETF World</p>
        <div className="text-right">
          <p className="text-xs text-slate-500">{lastUpdatedAt ? `MAJ : ${new Date(lastUpdatedAt).toLocaleString('fr-FR')}` : 'MAJ : —'}</p>
          {!hasOpportunity && (
            <p className="text-xs text-slate-500">Marché proche des plus hauts — aucune opportunité de renfort détectée.</p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        {entries.map((entry) => {
          const badge = badgeForStatus(entry.recommendation);
          return (
            <div key={entry.symbol} className="rounded-lg border border-slate-200 p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">
                  {entry.label} — {entry.symbol}
                </p>
                <div className="flex items-center gap-1.5">
                  <Badge size="sm" variant={badge.variant}>{badge.label}</Badge>
                  {!entry.isActive && onFollowEtf && (
                    <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => onFollowEtf(entry.symbol)}>
                      Suivre cet ETF
                    </Button>
                  )}
                </div>
              </div>
              {!entry.snapshot ? (
                <p className="mt-1 text-xs text-slate-500">Données indisponibles</p>
              ) : (
                <>
                  <p className="mt-1 text-xs text-slate-600">
                    Prix : {formatCurrency(entry.snapshot.currentPrice, currency)} / ATH : {formatCurrency(entry.snapshot.athPrice, currency)}
                  </p>
                  {!compact && (
                    <p className="text-xs text-slate-600">{formatPct(entry.snapshot.drawdownPercent)} sous le plus haut de référence</p>
                  )}
                  <p className="text-xs text-slate-700">Action : {actionLabel(entry, currency)}</p>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
