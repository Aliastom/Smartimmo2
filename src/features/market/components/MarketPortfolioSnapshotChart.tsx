'use client';

import React from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PortfolioSnapshot } from '@/features/market/portfolio/portfolioTypes';

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

interface MarketPortfolioSnapshotChartProps {
  snapshots: PortfolioSnapshot[];
  currency: string;
}

export function MarketPortfolioSnapshotChart({ snapshots, currency }: MarketPortfolioSnapshotChartProps) {
  if (snapshots.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Aucun instantané enregistré. Les points se créent en arrière-plan ; utilisez « Capturer un instantané » pour en ajouter un.
      </p>
    );
  }

  const anyIncomplete = snapshots.some((s) => s.valuationIncomplete);
  const data = snapshots.map((s) => ({
    date: new Date(s.capturedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }),
    valeur: s.totalMarketValue,
    netFiscal: s.netPerformanceAfterTaxEuro,
    netInflation: s.surplusInflationEuro,
  }));

  return (
    <div className="space-y-2">
      {anyIncomplete && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-950">
          Certains points ont été enregistrés sans cours sur toutes les lignes : la <span className="font-medium">valeur marché</span>{' '}
          peut être sous-estimée par rapport à un recalcul complet avec cours.
        </p>
      )}
      <p className="text-[11px] text-slate-500">
        Historique figé au moment T (ordres + cours du radar). Ne remplace pas le tableau de bord actuel.
      </p>
      <div className="h-[240px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
            <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} width={56} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <Tooltip
              formatter={(value: number, name: string) => [formatMoney(value, currency), name]}
              contentStyle={{ fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="valeur" name="Valeur (estim.)" stroke="#7c3aed" strokeWidth={2} dot={{ r: 2 }} />
            <Line type="monotone" dataKey="netFiscal" name="Perf. nette fiscal (estim.)" stroke="#0f766e" strokeWidth={1.5} dot={{ r: 2 }} />
            <Line type="monotone" dataKey="netInflation" name="Surplus vs inflation (estim.)" stroke="#ca8a04" strokeWidth={1} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
