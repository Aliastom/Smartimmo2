'use client';

import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  computeStrategySimulation,
  STRATEGY_SIM_HIGH_FACTOR,
  STRATEGY_SIM_LOW_FACTOR,
  type StrategySimId,
} from '@/features/market/services/marketStrategySimulation';
import type { InvestmentSettings } from '@/features/market/types';
import { TrendingUp } from 'lucide-react';

function safeFormatCurrency(value: number, currency: string): string | null {
  if (!Number.isFinite(value)) return null;
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

function formatEuro(value: number, currency: string): string {
  return safeFormatCurrency(value, currency) ?? '—';
}

function formatRange(low: number, high: number, currency: string): string {
  const lowStr = safeFormatCurrency(low, currency);
  const highStr = safeFormatCurrency(high, currency);
  if (!lowStr || !highStr) return 'fourchette indisponible';
  return `${lowStr} – ${highStr}`;
}

const BAR_COLORS: Record<StrategySimId, string> = {
  dca: '#7c3aed',
  lump: '#0ea5e9',
  wait: '#94a3b8',
};

interface MarketStrategySimulationCardProps {
  settings: InvestmentSettings;
}

export function MarketStrategySimulationCard({ settings }: MarketStrategySimulationCardProps) {
  const sim = useMemo(
    () =>
      computeStrategySimulation({
        monthlyDca: Math.max(0, settings.monthlyDcaAmount),
        lumpSumCash: Math.max(0, settings.availableCash),
      }),
    [settings.availableCash, settings.monthlyDcaAmount]
  );

  const chartData = useMemo(
    () =>
      sim.lines.map((line) => ({
        name:
          line.id === 'dca' ? 'DCA' : line.id === 'lump' ? 'Lump sum' : 'Attente',
        value: line.estimatedValue,
        id: line.id,
      })),
    [sim.lines]
  );

  const dcaLine = sim.lines.find((l) => l.id === 'dca')!;
  const lumpLine = sim.lines.find((l) => l.id === 'lump')!;
  const waitLine = sim.lines.find((l) => l.id === 'wait')!;

  const bandPctLow = Math.round((1 - STRATEGY_SIM_LOW_FACTOR) * 100);
  const bandPctHigh = Math.round((STRATEGY_SIM_HIGH_FACTOR - 1) * 100);

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50/90 to-white p-2.5 shadow-sm">
      <p className="mb-1 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
        <TrendingUp className="h-3.5 w-3.5 text-violet-600" aria-hidden />
        Projection indicative
      </p>
      <p className="text-[11px] leading-snug text-slate-500">
        Projection indicative sur <span className="font-medium text-slate-700">{sim.horizonYears} ans</span>, rendement
        moyen supposé <span className="font-medium text-slate-700">{(sim.annualReturnAssumption * 100).toFixed(0)} %</span>{' '}
        / an (hypothèse fixe), fourchette indicative −{bandPctLow} % / +{bandPctHigh} % autour de la valeur centrale.
        Aucune garantie de performance réelle.
      </p>

      <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-700">
        <li>
          <span className="font-semibold text-slate-900">
            DCA mensuel ({formatEuro(settings.monthlyDcaAmount, settings.currency)}/mois)
          </span>
          <br />
          <span className="text-slate-600">
            → Valeur estimée :{' '}
            <span className="font-semibold text-slate-900">{formatEuro(dcaLine.estimatedValue, settings.currency)}</span>{' '}
            <span className="text-slate-400">({formatRange(dcaLine.lowEstimate, dcaLine.highEstimate, settings.currency)})</span>
          </span>
        </li>
        <li>
          <span className="font-semibold text-slate-900">
            Lump sum ({formatEuro(settings.availableCash, settings.currency)} maintenant)
          </span>
          <br />
          <span className="text-slate-600">
            → Valeur estimée :{' '}
            <span className="font-semibold text-slate-900">{formatEuro(lumpLine.estimatedValue, settings.currency)}</span>{' '}
            <span className="text-slate-400">({formatRange(lumpLine.lowEstimate, lumpLine.highEstimate, settings.currency)})</span>
          </span>
        </li>
        <li>
          <span className="font-semibold text-slate-900">
            Attente « baisse » simplifiée ({sim.waitMonths} mois hors marché, puis investissement du lump sum)
          </span>
          <br />
          <span className="text-slate-600">
            → Valeur estimée :{' '}
            <span className="font-semibold text-slate-900">{formatEuro(waitLine.estimatedValue, settings.currency)}</span>{' '}
            <span className="text-slate-400">({formatRange(waitLine.lowEstimate, waitLine.highEstimate, settings.currency)})</span>
          </span>
        </li>
      </ul>

      <div className="mt-2 h-[140px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickFormatter={(v) =>
                Number.isFinite(v)
                  ? new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 0 }).format(v)
                  : ''
              }
              width={36}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: number) => [
                safeFormatCurrency(value, settings.currency) ?? 'fourchette indisponible',
                'Estimation',
              ]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
              {chartData.map((entry) => (
                <Cell key={entry.id} fill={BAR_COLORS[entry.id as StrategySimId]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex gap-1.5 text-[10px] text-slate-500">
        {sim.lines.map((line) => (
          <span key={line.id} className="inline-flex items-center gap-0.5">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: BAR_COLORS[line.id] }} />
            {line.id === 'dca' ? 'DCA' : line.id === 'lump' ? 'Lump sum' : 'Attente'}
            {line.id === sim.bestNumericId && <span className="font-medium text-violet-700"> (max. chiffré)</span>}
          </span>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50/80 px-2.5 py-2">
        <p className="text-xs font-semibold text-violet-900">Stratégie la plus robuste au timing : DCA</p>
        <p className="mt-1 text-[11px] leading-snug text-violet-900/90">
          Moins dépendante du moment où vous entrez sur le marché : vous lissez les prix et réduisez le risque de vous
          tromper une seule fois de date. Dans ce modèle volontairement simple, le meilleur chiffre central peut parfois
          correspondre au lump sum — en pratique, le futur reste incertain.
        </p>
      </div>

      <p className="mt-2 text-[11px] leading-snug text-slate-500">
        Temps passé hors marché = potentiel de performance non réalisé : chaque mois sans exposition, une partie du
        capital ne bénéficie pas du rendement moyen supposé (ici, les {sim.waitMonths} premiers mois de la stratégie
        « attente »).
      </p>
    </div>
  );
}
