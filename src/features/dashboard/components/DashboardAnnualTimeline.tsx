'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  TooltipProps,
  Legend,
} from 'recharts';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AnnualTimelineMonth } from '@/types/dashboard';

export interface DashboardAnnualTimelineProps {
  year: number;
  onYearChange: (year: number) => void;
  months: AnnualTimelineMonth[];
  loading?: boolean;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as AnnualTimelineMonth;
  if (!d) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm min-w-[200px]">
      <p className="font-semibold text-slate-900 mb-2">{d.label}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-slate-600">Loyers encaissés</span>
          <span className="font-medium text-emerald-600">{fmt(d.loyers_encaisses)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-600">Charges / Dépenses</span>
          <span className="font-medium text-red-600">{fmt(d.depenses)}</span>
        </div>
        <div className="flex justify-between gap-4 pt-1 border-t border-slate-100">
          <span className="text-slate-600">Cashflow</span>
          <span className={`font-medium ${d.cashflow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {fmt(d.cashflow)}
          </span>
        </div>
        <div className="flex justify-between gap-4 pt-1 border-t border-slate-100">
          <span className="text-slate-800 font-medium">Cashflow cumulé</span>
          <span className={`font-semibold ${d.cashflow_cumule >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {fmt(d.cashflow_cumule)}
          </span>
        </div>
      </div>
    </div>
  );
};

export function DashboardAnnualTimeline({
  year,
  onYearChange,
  months,
  loading = false,
}: DashboardAnnualTimelineProps) {
  const hasData = Array.isArray(months) && months.length > 0;

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="py-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-slate-800">Évolution financière annuelle</h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onYearChange(year - 1)}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label="Année précédente"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[80px] text-center font-medium text-slate-900 tabular-nums">{year}</span>
            <button
              type="button"
              onClick={() => onYearChange(year + 1)}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label="Année suivante"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-slate-500 text-sm">Chargement…</div>
        ) : !hasData ? (
          <p className="text-sm text-slate-500 py-8">Aucune donnée pour cette année.</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={months} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#64748b" />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)} k€`} tick={{ fontSize: 11 }} stroke="#64748b" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="loyers_encaisses" name="Loyers encaissés" fill="#10b981" radius={[2, 2, 0, 0]} />
              <Bar dataKey="depenses" name="Dépenses" fill="#ef4444" radius={[2, 2, 0, 0]} />
              <Line type="monotone" dataKey="cashflow" name="Cashflow" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="cashflow_cumule" name="Cashflow cumulé" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 4" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
