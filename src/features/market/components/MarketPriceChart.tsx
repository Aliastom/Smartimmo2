'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from 'recharts';
import type { MarketHistoryPoint } from '@/features/market/services/marketDataService';

interface MarketPriceChartProps {
  series: MarketHistoryPoint[];
  athPrice: number;
  currentPrice: number;
  reinforce10Threshold: number;
  reinforce20Threshold: number;
  /** Seuils drawdown additionnels pour repères visuels (zones V2) */
  reinforce30Threshold?: number;
  reinforce40Threshold?: number;
  isRefreshing?: boolean;
  etfLabel: string;
  etfSymbol: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

function formatDateLabel(dateIso: string): string {
  const d = new Date(dateIso);
  return d.toLocaleDateString('fr-FR', { month: '2-digit', year: '2-digit' });
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

const ChartTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as { date: string; close: number };
  if (!row) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-slate-900">{new Date(row.date).toLocaleDateString('fr-FR')}</p>
      <p className="text-slate-600">Prix: <span className="font-semibold text-slate-900">{formatCurrency(row.close)}</span></p>
    </div>
  );
};

export function MarketPriceChart({
  series,
  athPrice,
  currentPrice,
  reinforce10Threshold,
  reinforce20Threshold,
  reinforce30Threshold = -30,
  reinforce40Threshold = -40,
  isRefreshing = false,
  etfLabel,
  etfSymbol,
}: MarketPriceChartProps) {
  if (!Number.isFinite(athPrice) || athPrice <= 0) return null;
  if (!series.length && !isRefreshing) return null;
  if (!series.length && isRefreshing) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Historique prix</p>
        <p className="text-xs leading-5 text-slate-500">Chargement des données historiques...</p>
        <div className="h-[220px] animate-pulse rounded-lg bg-slate-100" />
      </div>
    );
  }

  const threshold10Price = athPrice * (1 + reinforce10Threshold / 100);
  const threshold20Price = athPrice * (1 + reinforce20Threshold / 100);
  const threshold30Price = athPrice * (1 + reinforce30Threshold / 100);
  const threshold40Price = athPrice * (1 + reinforce40Threshold / 100);
  const latest = series[series.length - 1];

  return (
    <div className="relative min-w-0 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Historique prix</p>
      </div>
      <p className="mb-2 text-xs leading-5 text-slate-500">
        Courbe journalière — {etfLabel} / {etfSymbol}
      </p>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-blue-600" />
          Prix
        </span>
        <span
          className="inline-flex cursor-help items-center gap-1"
          title="Plus haut historique sur la période sélectionnée"
        >
          <span className="h-2 w-2 rounded-full bg-slate-900" />
          ATH
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          Seuil opportunité ({formatPct(reinforce10Threshold)})
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-600" />
          {formatPct(reinforce20Threshold)}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-violet-600" />
          {formatPct(reinforce30Threshold)}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-fuchsia-700" />
          {formatPct(reinforce40Threshold)}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={series} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateLabel}
            minTickGap={36}
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickFormatter={(value) => new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(value)}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip content={<ChartTooltip />} />
          <ReferenceLine y={athPrice} stroke="#0f172a" strokeDasharray="4 4" ifOverflow="extendDomain" label={{ value: 'ATH', position: 'insideTopRight', fill: '#0f172a', fontSize: 11 }} />
          <ReferenceLine y={threshold10Price} stroke="#f59e0b" strokeDasharray="3 3" ifOverflow="extendDomain" />
          <ReferenceLine y={threshold20Price} stroke="#dc2626" strokeDasharray="3 3" ifOverflow="extendDomain" />
          <ReferenceLine y={threshold30Price} stroke="#7c3aed" strokeDasharray="3 3" ifOverflow="extendDomain" />
          <ReferenceLine y={threshold40Price} stroke="#a21caf" strokeDasharray="3 3" ifOverflow="extendDomain" />
          <Line type="monotone" dataKey="close" stroke="#2563eb" strokeWidth={2} dot={false} isAnimationActive={false} />
          <ReferenceDot x={latest.date} y={currentPrice} r={4} fill="#1d4ed8" stroke="#ffffff" strokeWidth={1.5} ifOverflow="visible" />
        </LineChart>
      </ResponsiveContainer>
      {isRefreshing && (
        <div className="absolute inset-x-0 top-14 z-10 rounded-md border border-slate-200/80 bg-white/80 px-2 py-1 text-xs text-slate-600 backdrop-blur-[1px]">
          Mise à jour...
        </div>
      )}
    </div>
  );
}
