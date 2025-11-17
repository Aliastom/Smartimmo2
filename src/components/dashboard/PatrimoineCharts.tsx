'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { TooltipProps } from 'recharts';

// Dynamic imports pour Recharts (réduire le bundle initial)
const ResponsiveContainer = dynamic(
  () => import('recharts').then(mod => mod.ResponsiveContainer),
  { ssr: false }
);

const BarChart = dynamic(
  () => import('recharts').then(mod => mod.BarChart),
  { ssr: false }
);

const Bar = dynamic(
  () => import('recharts').then(mod => mod.Bar),
  { ssr: false }
);

const LineChart = dynamic(
  () => import('recharts').then(mod => mod.LineChart),
  { ssr: false }
);

const Line = dynamic(
  () => import('recharts').then(mod => mod.Line),
  { ssr: false }
);

const PieChart = dynamic(
  () => import('recharts').then(mod => mod.PieChart),
  { ssr: false }
);

const Pie = dynamic(
  () => import('recharts').then(mod => mod.Pie),
  { ssr: false }
);

const Cell = dynamic(
  () => import('recharts').then(mod => mod.Cell),
  { ssr: false }
);

const XAxis = dynamic(
  () => import('recharts').then(mod => mod.XAxis),
  { ssr: false }
);

const YAxis = dynamic(
  () => import('recharts').then(mod => mod.YAxis),
  { ssr: false }
);

const CartesianGrid = dynamic(
  () => import('recharts').then(mod => mod.CartesianGrid),
  { ssr: false }
);

const Tooltip = dynamic(
  () => import('recharts').then(mod => mod.Tooltip),
  { ssr: false }
);

const Legend = dynamic(
  () => import('recharts').then(mod => mod.Legend),
  { ssr: false }
);
import { MonthlySeriesItem, RepartitionParBienItem } from '@/types/dashboard';
import { FileText } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/shared/select';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

interface PatrimoineChartsProps {
  loyers: MonthlySeriesItem[];
  charges: MonthlySeriesItem[];
  cashflow: MonthlySeriesItem[];
  repartitionParBien: RepartitionParBienItem[];
  isLoading?: boolean;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

// Tooltip personnalisé pour les graphiques
const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (!active || !payload || !payload.length) return null;

  const formatMonth = (yyyymm: string) => {
    const [year, month] = yyyymm.split('-');
    const monthNames = [
      'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jui',
      'Jui', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 mb-2">{formatMonth(label)}</p>
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex justify-between gap-4">
            <span className="text-gray-600" style={{ color: entry.color }}>
              {entry.name}:
            </span>
            <span className="font-medium" style={{ color: entry.color }}>
              {new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: 'EUR',
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

export const PatrimoineCharts = React.memo(function PatrimoineCharts({
  loyers,
  charges,
  cashflow,
  repartitionParBien,
  isLoading = false,
}: PatrimoineChartsProps) {
  const [repartitionType, setRepartitionType] = useState<'loyers' | 'charges' | 'cashflow'>('loyers');
  const [compareYears, setCompareYears] = useState(false);

  // Préparer les données pour le BarChart (Loyers vs Charges)
  const barData = loyers.map((loyer, index) => ({
    month: formatMonthLabel(loyer.month),
    monthFull: loyer.month,
    loyers: loyer.value,
    charges: charges[index]?.value || 0,
  }));

  // Préparer les données pour le mode comparatif (année N vs N-1)
  const prepareComparisonData = () => {
    const grouped = new Map<string, { currentYear: number; previousYear: number; currentYearCharges: number; previousYearCharges: number }>();
    
    loyers.forEach((item, index) => {
      const [year, month] = item.month.split('-');
      const monthKey = month; // Utiliser uniquement le mois comme clé
      
      if (!grouped.has(monthKey)) {
        grouped.set(monthKey, { currentYear: 0, previousYear: 0, currentYearCharges: 0, previousYearCharges: 0 });
      }
      
      const entry = grouped.get(monthKey)!;
      const yearNum = parseInt(year);
      const currentYearMax = Math.max(...loyers.map(l => parseInt(l.month.split('-')[0])));
      
      if (yearNum === currentYearMax) {
        entry.currentYear = item.value;
        entry.currentYearCharges = charges[index]?.value || 0;
      } else if (yearNum === currentYearMax - 1) {
        entry.previousYear = item.value;
        entry.previousYearCharges = charges[index]?.value || 0;
      }
    });
    
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jui', 'Jui', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    return Array.from(grouped.entries())
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .map(([month, data]) => ({
        month: monthNames[parseInt(month) - 1],
        'Loyers N': data.currentYear,
        'Loyers N-1': data.previousYear,
        'Charges N': data.currentYearCharges,
        'Charges N-1': data.previousYearCharges,
      }));
  };

  const comparisonData = compareYears ? prepareComparisonData() : [];

  // Préparer les données pour le LineChart (Cashflow)
  const lineData = cashflow.map((item) => ({
    month: formatMonthLabel(item.month),
    monthFull: item.month,
    cashflow: item.value,
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

  // Calculer les limites adaptatives pour le cashflow mensuel (avec marge de 12%)
  const cashflowValues = cashflow.map(item => item.value);
  const minCashflow = Math.min(...cashflowValues, 0);
  const maxCashflow = Math.max(...cashflowValues, 0);
  const range = Math.abs(maxCashflow - minCashflow);
  const margin = range > 0 ? range * 0.12 : Math.max(Math.abs(minCashflow), Math.abs(maxCashflow)) * 0.15;
  
  // Utiliser 'auto' avec une fonction de padding pour ajouter une marge
  const yAxisDomainCashflow: [string | number, string | number] = ['auto', 'auto'];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Graphique 1 : Loyers vs Charges (BarChart groupé) */}
      <Card className="md:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Loyers vs Charges</CardTitle>
            <Button
              variant={compareYears ? "default" : "outline"}
              size="sm"
              onClick={() => setCompareYears(!compareYears)}
              className="text-xs"
            >
              {compareYears ? '✓ ' : ''}Comparer avec année précédente
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {barData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <FileText className="h-12 w-12 mb-2 opacity-30" />
              <p className="text-sm">Aucune donnée sur cette période</p>
            </div>
          ) : compareYears && comparisonData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={comparisonData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
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
                <Legend />
                <Bar dataKey="Loyers N" fill="#3b82f6" name="Loyers N" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Loyers N-1" fill="#60a5fa" name="Loyers N-1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Charges N" fill="#ef4444" name="Charges N" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Charges N-1" fill="#f87171" name="Charges N-1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
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
                <Legend />
                <Bar dataKey="loyers" fill="#3b82f6" name="Loyers" radius={[4, 4, 0, 0]} />
                <Bar dataKey="charges" fill="#ef4444" name="Charges" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Graphique 2 : Cashflow mensuel (LineChart) avec échelle adaptative */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Cashflow mensuel</CardTitle>
        </CardHeader>
        <CardContent>
          {lineData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <FileText className="h-12 w-12 mb-2 opacity-30" />
              <p className="text-sm">Aucune donnée sur cette période</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={lineData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                  tickLine={false}
                />
                <YAxis
                  domain={yAxisDomainCashflow}
                  allowDataOverflow={false}
                  scale="auto"
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
                <Line
                  type="monotone"
                  dataKey="cashflow"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: '#10b981', r: 3 }}
                  activeDot={{ r: 5 }}
                  name="Cashflow"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Graphique 2.5 : Cashflow cumulé (trésorerie projetée) */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Cashflow cumulé (trésorerie projetée)</CardTitle>
        </CardHeader>
        <CardContent>
          {cumulativeData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <FileText className="h-12 w-12 mb-2 opacity-30" />
              <p className="text-sm">Aucune donnée sur cette période</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={cumulativeData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
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
                <Line
                  type="monotone"
                  dataKey="cumul"
                  stroke={cumulativeData[cumulativeData.length - 1]?.cumul >= 0 ? '#22c55e' : '#ef4444'}
                  strokeWidth={2}
                  dot={{ fill: cumulativeData[cumulativeData.length - 1]?.cumul >= 0 ? '#22c55e' : '#ef4444', r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Cumul"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Graphique 3 : Répartition par bien (PieChart/Donut) */}
      <Card className="md:col-span-3">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">
              Répartition par bien
              {repartitionType === 'loyers' && ' - Loyers'}
              {repartitionType === 'charges' && ' - Charges'}
              {repartitionType === 'cashflow' && ' - Cashflow net'}
            </CardTitle>
            <Select value={repartitionType} onValueChange={(value: 'loyers' | 'charges' | 'cashflow') => setRepartitionType(value)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="loyers">💰 Loyers</SelectItem>
                <SelectItem value="charges">💸 Charges</SelectItem>
                <SelectItem value="cashflow">📊 Cashflow net</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {!Array.isArray(repartitionParBien) || repartitionParBien.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <FileText className="h-12 w-12 mb-2 opacity-30" />
              <p className="text-sm">Aucune répartition disponible</p>
              <p className="text-xs text-gray-500 mt-2">
                Les données de répartition seront disponibles après la première période d'activité
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={Array.isArray(repartitionParBien) ? repartitionParBien : []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ label, percent }) => `${label}: ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {(Array.isArray(repartitionParBien) ? repartitionParBien : []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
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
                      }).format(value),
                      repartitionType === 'loyers' ? 'Loyers' : repartitionType === 'charges' ? 'Charges' : 'Cashflow net',
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
                    iconSize={12}
                  />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Tableau récapitulatif */}
              <div className="border-t pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {repartitionParBien.slice(0, 6).map((item, index) => {
                    const totalValue = repartitionParBien.reduce((sum, i) => sum + i.value, 0);
                    const percentage = totalValue > 0 ? (item.value / totalValue * 100).toFixed(0) : 0;
                    const valueColor = repartitionType === 'cashflow' && item.value < 0 ? 'text-red-600' : 'text-gray-700';
                    
                    return (
                      <div 
                        key={index} 
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="text-sm font-medium text-gray-900 truncate">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={cn("text-sm font-semibold", valueColor)}>
                            {new Intl.NumberFormat('fr-FR', {
                              style: 'currency',
                              currency: 'EUR',
                              maximumFractionDigits: 0,
                            }).format(item.value)}
                          </span>
                          <span className="text-xs text-gray-500">
                            ({percentage}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

