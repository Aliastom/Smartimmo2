'use client';

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  TooltipProps,
  Cell,
  LabelList,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { MonthlySeriesItem, RepartitionParBienItem } from '@/types/dashboard';
import { FileText } from 'lucide-react';
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

// Tooltip personnalisé pour les graphiques
const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (!active || !payload || !payload.length) return null;

  const formatMonth = (yyyymm: string) => {
    if (!yyyymm || !yyyymm.includes('-')) return label || yyyymm;
    const [year, month] = yyyymm.split('-');
    const monthNames = [
      'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jui',
      'Jui', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  const title = (payload[0]?.payload as { monthFull?: string })?.monthFull ? formatMonth((payload[0].payload as { monthFull: string }).monthFull) : (label ?? '');

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-4 text-sm min-w-[160px]">
      <p className="font-semibold text-gray-900 mb-3 text-base">{title}</p>
      <div className="space-y-2">
        {payload.map((entry, index) => (
          <div key={index} className="flex justify-between gap-6 items-baseline">
            <span className="text-gray-600 font-medium" style={{ color: entry.color }}>
              {entry.name}
            </span>
            <span className="font-semibold tabular-nums" style={{ color: entry.color }}>
              {new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: 'EUR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(entry.value || 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const formatMonthLabel = (yyyymm: string) => {
  const [year, month] = yyyymm.split('-');
  const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jui', 'Jui', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  return monthNames[parseInt(month) - 1];
};

interface PatrimoineChartsInternalProps {
  loyers: MonthlySeriesItem[];
  charges: MonthlySeriesItem[];
  cashflow: MonthlySeriesItem[];
  repartitionParBien: RepartitionParBienItem[];
  repartitionParBienLoyers?: RepartitionParBienItem[];
  repartitionParBienCharges?: RepartitionParBienItem[];
  repartitionParBienCashflow?: RepartitionParBienItem[];
  isLoading?: boolean;
  /** 'all' = tous les graphiques, 'evolution' = Loyers vs Charges + Cashflow cumulé, 'repartition' = Répartition par bien uniquement */
  variant?: 'all' | 'evolution' | 'repartition';
  /** Mode pour libellé dynamique du cashflow cumulé */
  mode?: 'realise' | 'prevision' | 'lisse';
}

export function PatrimoineChartsInternal({
  loyers,
  charges,
  cashflow,
  repartitionParBien,
  repartitionParBienLoyers,
  repartitionParBienCharges,
  repartitionParBienCashflow,
  isLoading = false,
  variant = 'all',
  mode = 'realise',
}: PatrimoineChartsInternalProps) {
  const showEvolution = variant === 'all' || variant === 'evolution';
  const showRepartition = variant === 'all' || variant === 'repartition';
  const [repartitionType, setRepartitionType] = useState<'loyers' | 'charges' | 'cashflow'>('loyers');

  const cashflowCumuleLabel =
    mode === 'prevision'
      ? 'Cashflow cumulé (trésorerie projetée)'
      : mode === 'lisse'
        ? 'Cashflow cumulé (trésorerie lissée)'
        : 'Cashflow cumulé (trésorerie réalisée)';
  
  // Sélectionner la bonne répartition selon le type
  const currentRepartition = useMemo(() => {
    if (repartitionType === 'loyers' && repartitionParBienLoyers) {
      return repartitionParBienLoyers;
    }
    if (repartitionType === 'charges' && repartitionParBienCharges) {
      return repartitionParBienCharges;
    }
    if (repartitionType === 'cashflow' && repartitionParBienCashflow) {
      return repartitionParBienCashflow;
    }
    // Fallback sur repartitionParBien si les données spécifiques ne sont pas disponibles
    return repartitionParBien;
  }, [repartitionType, repartitionParBien, repartitionParBienLoyers, repartitionParBienCharges, repartitionParBienCashflow]);

  // Préparer les données pour le graphique fusionné (Loyers + Charges + Cashflow)
  const fluxData = loyers.map((loyer, index) => ({
    month: formatMonthLabel(loyer.month),
    monthFull: loyer.month,
    loyers: loyer.value,
    charges: charges[index]?.value || 0,
    cashflow: cashflow[index]?.value ?? 0,
  }));


  // Calculer le cashflow cumulé
  let cumul = 0;
  const cumulativeData = cashflow.map((item) => {
    cumul += item.value;
    return {
      month: formatMonthLabel(item.month),
      monthFull: item.month,
      cumul,
    };
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded w-1/2" />
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-gray-200 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showEvolution && (
        <>
      {/* Graphique 1 : Flux mensuels (Loyers + Charges + Cashflow) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Flux mensuels</CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Barres bleues = loyers encaissés · Barres rouges = charges · Courbe verte = cashflow (loyers − charges)
          </p>
        </CardHeader>
        <CardContent>
          {fluxData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-52 text-gray-400">
              <FileText className="h-12 w-12 mb-2 opacity-30" />
              <p className="text-sm">Aucune donnée sur cette période</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260} minHeight={220}>
              <ComposedChart data={fluxData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                  tickLine={false}
                  tickFormatter={(value) =>
                    new Intl.NumberFormat('fr-FR', {
                      notation: 'compact',
                      maximumFractionDigits: 0,
                    }).format(value)
                  }
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: 8 }} iconSize={12} iconType="square" formatter={(value) => <span className="text-sm font-medium text-gray-700">{value}</span>} />
                <Bar dataKey="loyers" fill="#2563eb" name="Loyers encaissés" radius={[4, 4, 0, 0]} />
                <Bar dataKey="charges" fill="#ef4444" name="Charges" radius={[4, 4, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="cashflow"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                  name="Cashflow"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Graphique 2 : Cashflow cumulé — libellé dynamique selon mode */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">{cashflowCumuleLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          {cumulativeData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-52 text-gray-400">
              <FileText className="h-12 w-12 mb-2 opacity-30" />
              <p className="text-sm">Aucune donnée sur cette période</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260} minHeight={220}>
              <LineChart data={cumulativeData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 13, fill: '#4b5563' }}
                  stroke="#9ca3af"
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 13, fill: '#4b5563' }}
                  stroke="#9ca3af"
                  tickLine={false}
                  tickFormatter={(value) =>
                    new Intl.NumberFormat('fr-FR', {
                      notation: 'compact',
                      maximumFractionDigits: 0,
                    }).format(value)
                  }
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="cumul"
                  stroke={cumulativeData[cumulativeData.length - 1]?.cumul >= 0 ? '#22c55e' : '#ef4444'}
                  strokeWidth={3}
                  dot={{ fill: cumulativeData[cumulativeData.length - 1]?.cumul >= 0 ? '#22c55e' : '#ef4444', r: 4, strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                  name="Cumul"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
        </>
      )}

      {showRepartition && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Répartition par bien</CardTitle>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-sm text-gray-500">Afficher :</span>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 shadow-sm" role="group" aria-label="Type de répartition">
              {(['loyers', 'charges', 'cashflow'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setRepartitionType(t)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                    repartitionType === t
                      ? 'bg-white text-gray-900 shadow-sm border border-slate-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                  }`}
                >
                  {t === 'loyers' && 'Loyers'}
                  {t === 'charges' && 'Charges'}
                  {t === 'cashflow' && 'Cashflow net'}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!Array.isArray(currentRepartition) || currentRepartition.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-52 text-gray-400">
              <FileText className="h-12 w-12 mb-2 opacity-30" />
              <p className="text-sm">Aucune répartition disponible</p>
              <p className="text-xs text-gray-500 mt-2">
                Les données de répartition seront disponibles après la première période d'activité
              </p>
            </div>
          ) : (
            <div className="w-full">
              <ResponsiveContainer width="100%" height={Math.max(260, Math.min(320, currentRepartition.length * 38))}>
                <BarChart
                  data={[...currentRepartition].sort((a, b) => b.value - a.value)}
                  layout="vertical"
                  margin={{ top: 8, right: 85, left: 100, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 13, fill: '#4b5563' }}
                    stroke="#9ca3af"
                    tickLine={false}
                    tickFormatter={(value) =>
                      new Intl.NumberFormat('fr-FR', {
                        notation: 'compact',
                        maximumFractionDigits: 0,
                      }).format(value)
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fontSize: 13, fill: '#4b5563' }}
                    stroke="#9ca3af"
                    tickLine={false}
                    width={90}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [
                      new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'EUR',
                        maximumFractionDigits: 0,
                      }).format(value),
                      repartitionType === 'loyers' ? 'Loyers' : repartitionType === 'charges' ? 'Charges' : 'Cashflow net',
                    ]}
                    labelFormatter={(label) => label}
                  />
                  <Bar
                    dataKey="value"
                    radius={[0, 4, 4, 0]}
                  >
                    {[...currentRepartition].sort((a, b) => b.value - a.value).map((entry, index) => (
                      <Cell
                        key={`cell-${entry.label}-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                    <LabelList
                      dataKey="value"
                      position="right"
                      formatter={(v: number) =>
                        new Intl.NumberFormat('fr-FR', {
                          style: 'currency',
                          currency: 'EUR',
                          maximumFractionDigits: 0,
                        }).format(v)
                      }
                      style={{ fontSize: 12, fill: '#374151', fontWeight: 500 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}

