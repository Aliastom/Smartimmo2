'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
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
import { TrendingUp } from 'lucide-react';

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

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<string | number>(currentYear);

  // Calculer les données mensuelles (année sélectionnée uniquement)
  const { months, monthly, cumulative, totals } = useMonthlyNet({
    transactions,
    year: selectedYear as number,
    selectedPropertyIds,
    statusFilter,
    properties,
    showAllYears: false,
  });

  // Préparer les données pour Recharts
  const chartData = months.map((month, index) => ({
    month,
    cumulative: cumulative[index],
    income: monthly[index].income,
    expense: monthly[index].expense,
    net: monthly[index].net,
  }));

  return (
    <Card className="w-full">
      <CardHeader className="py-2 pb-1">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold text-gray-900">Bénéfice net cumulé</CardTitle>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            aria-label="Année"
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-2">
        {chartData.every((d) => d.cumulative === 0) ? (
          <div className="flex flex-col items-center justify-center h-24 text-gray-400">
            <TrendingUp className="h-6 w-6 mb-1 opacity-30" />
            <p className="text-xs">Aucune transaction pour {selectedYear}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={126}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
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

