'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
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
  Area,
  AreaChart,
} from 'recharts';
import { TrendingUp, Home } from 'lucide-react';

export interface MonthlyRentData {
  month: string; // Format: 'YYYY-MM'
  totalRent: number;
}

export interface YearlyRentData {
  year: number;
  totalRent: number;
}

interface LeasesRentEvolutionChartProps {
  monthlyData: MonthlyRentData[];
  yearlyData: YearlyRentData[];
  isLoading?: boolean;
}

// Tooltip personnalisé pour vue mensuelle
const MonthlyTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  
  // Formater le nom du mois (YYYY-MM -> Mois Année)
  const formatMonth = (yyyymm: string) => {
    const [year, month] = yyyymm.split('-');
    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 mb-2">{formatMonth(data.month)}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Loyers mensuels:</span>
          <span className="font-semibold text-blue-600">
            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(data.totalRent)}
          </span>
        </div>
      </div>
    </div>
  );
};

// Tooltip personnalisé pour vue annuelle
const YearlyTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 mb-2">{data.year}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Loyers annuels:</span>
          <span className="font-semibold text-blue-600">
            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(data.totalRent)}
          </span>
        </div>
      </div>
    </div>
  );
};

export function LeasesRentEvolutionChart({
  monthlyData,
  yearlyData,
  isLoading = false,
}: LeasesRentEvolutionChartProps) {
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');

  // Formater les labels de mois pour l'axe X
  const formatMonthLabel = (yyyymm: string) => {
    const [year, month] = yyyymm.split('-');
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jui', 'Jui', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    return monthNames[parseInt(month) - 1];
  };

  // Préparer les données mensuelles avec labels courts
  const monthlyChartData = monthlyData.map((d) => ({
    ...d,
    monthLabel: formatMonthLabel(d.month),
  }));

  // Préparer les données annuelles
  const yearlyChartData = yearlyData.map((d) => ({
    ...d,
    yearLabel: d.year.toString(),
  }));

  const currentData = viewMode === 'monthly' ? monthlyChartData : yearlyChartData;
  const latestTotal = viewMode === 'monthly' 
    ? (monthlyData.length > 0 ? monthlyData[monthlyData.length - 1].totalRent : 0)
    : (yearlyData.length > 0 ? yearlyData[yearlyData.length - 1].totalRent : 0);

  if (isLoading) {
    return (
      <Card className="w-full col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Évolution des loyers des baux actifs</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-center h-64 text-gray-400">
            <div className="animate-pulse">Chargement...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full col-span-2">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-base font-semibold">Évolution des loyers des baux actifs</CardTitle>
            <p className="text-sm text-gray-600">
              {viewMode === 'monthly' ? 'Total mensuel' : 'Total annuel'}: {new Intl.NumberFormat('fr-FR', { 
                style: 'currency', 
                currency: 'EUR', 
                maximumFractionDigits: 0 
              }).format(latestTotal)}
            </p>
          </div>
          
          {/* Toggle Mois/Année */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'monthly'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Mois
            </button>
            <button
              onClick={() => setViewMode('yearly')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'yearly'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Année
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {currentData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Home className="h-12 w-12 mb-2 opacity-30" />
            <p className="text-sm">Aucun bail actif sur cette période</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={currentData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="colorRent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey={viewMode === 'monthly' ? 'monthLabel' : 'yearLabel'}
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
              <Tooltip content={viewMode === 'monthly' ? <MonthlyTooltip /> : <YearlyTooltip />} />
              <Area
                type="monotone"
                dataKey="totalRent"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#colorRent)"
                dot={{ fill: '#3b82f6', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

