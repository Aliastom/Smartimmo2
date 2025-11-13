'use client';

import React from 'react';
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
  Area,
  AreaChart,
} from 'recharts';
import { TrendingUp } from 'lucide-react';

export interface MonthlyData {
  month: string; // Format: 'YYYY-MM'
  net: number;
  cumulated: number;
  income: number;
  expense: number;
}

interface TransactionsCumulativeChartProps {
  data: MonthlyData[];
  isLoading?: boolean;
}

// Tooltip personnalisé
const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
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
          <span className="text-gray-600">Recettes:</span>
          <span className="font-medium text-green-600">
            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(data.income)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Dépenses:</span>
          <span className="font-medium text-red-600">
            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Math.abs(data.expense))}
          </span>
        </div>
        <div className="flex justify-between gap-4 pt-1 border-t border-gray-200">
          <span className="text-gray-600">Net mois:</span>
          <span className={`font-semibold ${data.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(data.net)}
          </span>
        </div>
        <div className="flex justify-between gap-4 pt-1 border-t border-gray-200">
          <span className="text-gray-900 font-medium">Solde cumulé:</span>
          <span className={`font-bold ${data.cumulated >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(data.cumulated)}
          </span>
        </div>
      </div>
    </div>
  );
};

export function TransactionsCumulativeChart({
  data,
  isLoading = false,
}: TransactionsCumulativeChartProps) {
  // Formater les labels de mois pour l'axe X
  const formatMonthLabel = (yyyymm: string) => {
    const [year, month] = yyyymm.split('-');
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jui', 'Jui', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    return monthNames[parseInt(month) - 1];
  };

  // Préparer les données avec labels courts
  const chartData = data.map((d) => ({
    ...d,
    monthLabel: formatMonthLabel(d.month),
  }));

  const totalCumulated = data.length > 0 ? data[data.length - 1].cumulated : 0;

  if (isLoading) {
    return (
      <Card className="w-full col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Évolution mensuelle cumulée</CardTitle>
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
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold">Évolution mensuelle cumulée</CardTitle>
            <p className="text-sm text-gray-600">
              Solde final: {new Intl.NumberFormat('fr-FR', { 
                style: 'currency', 
                currency: 'EUR', 
                maximumFractionDigits: 0 
              }).format(totalCumulated)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <TrendingUp className="h-12 w-12 mb-2 opacity-30" />
            <p className="text-sm">Aucune transaction sur cette période</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="colorCumulated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="monthLabel"
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
              <Area
                type="monotone"
                dataKey="cumulated"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#colorCumulated)"
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

