'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  TooltipProps,
} from 'recharts';
import { useMonthlyNet } from '../hooks/useMonthlyNet';
import { usePropertyFilters } from '@/features/properties/store/usePropertyFilters';
import type { Transaction, Property } from '../types';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface NetCumulativeChartProps {
  transactions: Transaction[];
  properties: Property[];
}

// Tooltip personnalisé
const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 mb-2">{data.month}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Revenus:</span>
          <span className="font-medium text-green-600">
            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(data.income)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Dépenses:</span>
          <span className="font-medium text-red-600">
            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(data.expense)}
          </span>
        </div>
        <div className="flex justify-between gap-4 pt-1 border-t border-gray-200">
          <span className="text-gray-600">Net:</span>
          <span className={`font-semibold ${data.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(data.net)}
          </span>
        </div>
        <div className="flex justify-between gap-4 pt-1 border-t border-gray-200">
          <span className="text-gray-900 font-medium">Cumul:</span>
          <span className={`font-bold ${data.cumulative >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(data.cumulative)}
          </span>
        </div>
      </div>
    </div>
  );
};

export function NetCumulativeChart({ transactions, properties }: NetCumulativeChartProps) {
  const { selectedPropertyIds, statusFilter } = usePropertyFilters();
  
  // Déterminer les années disponibles
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    if (!transactions.length) return [currentYear];
    const years = new Set(transactions.map((t) => new Date(t.date).getFullYear()));
    const yearsArray = Array.from(years).sort((a, b) => b - a);
    // S'assurer que l'année courante est toujours présente
    if (!yearsArray.includes(currentYear)) {
      yearsArray.unshift(currentYear);
    }
    return yearsArray;
  }, [transactions]);

  const [selectedYear, setSelectedYear] = useState<string | number>('all');

  // Déterminer si on affiche toutes les années ou une année spécifique
  const showAllYears = selectedYear === 'all';

  // Calculer les données mensuelles
  const { months, monthly, cumulative, totals } = useMonthlyNet({
    transactions,
    year: showAllYears ? new Date().getFullYear() : selectedYear as number,
    selectedPropertyIds,
    statusFilter,
    properties,
    showAllYears,
  });

  // Préparer les données pour Recharts
  const chartData = months.map((month, index) => ({
    month,
    cumulative: cumulative[index],
    income: monthly[index].income,
    expense: monthly[index].expense,
    net: monthly[index].net,
  }));

  // Calculer la variation vs année précédente (optionnel)
  const previousYearData = useMonthlyNet({
    transactions,
    year: selectedYear - 1,
    selectedPropertyIds,
    statusFilter,
    properties,
  });

  const deltaVsPrevious = totals.net - previousYearData.totals.net;
  const deltaPercentage =
    previousYearData.totals.net !== 0
      ? ((deltaVsPrevious / Math.abs(previousYearData.totals.net)) * 100).toFixed(1)
      : null;

  const getTrendIcon = () => {
    if (deltaVsPrevious > 0) return <TrendingUp className="h-3 w-3" />;
    if (deltaVsPrevious < 0) return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const getTrendColor = () => {
    if (deltaVsPrevious > 0) return 'text-green-600 bg-green-50 border-green-200';
    if (deltaVsPrevious < 0) return 'text-red-600 bg-red-50 border-red-200';
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold">Bénéfice net cumulé</CardTitle>
            <p className="text-sm text-gray-600">
              {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(totals.net)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {deltaPercentage && !showAllYears && (
              <Badge variant="secondary" className={`${getTrendColor()} flex items-center gap-1 text-xs`}>
                {getTrendIcon()}
                {deltaVsPrevious > 0 ? '+' : ''}{deltaPercentage}% vs {selectedYear - 1}
              </Badge>
            )}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Sélectionner l'année"
            >
              <option value="all">Tout</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {chartData.every((d) => d.cumulative === 0) ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <TrendingUp className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">
              {showAllYears ? 'Aucune transaction' : `Aucune transaction pour ${selectedYear}`}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
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
                    compactDisplay: 'short',
                  }).format(value)
                }
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="cumulative"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

