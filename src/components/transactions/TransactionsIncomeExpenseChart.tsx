'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  TooltipProps,
} from 'recharts';
import { TrendingUp, TrendingDown, Euro } from 'lucide-react';

export interface IncomeExpenseData {
  income: number;
  expense: number;
}

interface TransactionsIncomeExpenseChartProps {
  data: IncomeExpenseData;
  isLoading?: boolean;
}

const COLORS = {
  income: '#10b981', // green
  expense: '#ef4444', // red
};

// Tooltip personnalisé
const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0];
  const Icon = data.name === 'Recettes' ? TrendingUp : TrendingDown;
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4" style={{ color: data.payload.fill }} />
        <span className="font-semibold text-gray-900">{data.name}</span>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Montant:</span>
          <span className="font-medium">
            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(data.value || 0)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Pourcentage:</span>
          <span className="font-medium">{data.payload.percentage}%</span>
        </div>
      </div>
    </div>
  );
};

export function TransactionsIncomeExpenseChart({
  data,
  isLoading = false,
}: TransactionsIncomeExpenseChartProps) {
  const total = data.income + Math.abs(data.expense);
  const net = data.income + data.expense; // expense est déjà négatif

  // Préparer les données pour le graphique
  const chartData = [
    {
      name: 'Recettes',
      value: data.income,
      percentage: total > 0 ? ((data.income / total) * 100).toFixed(1) : '0',
      fill: COLORS.income,
    },
    {
      name: 'Dépenses',
      value: Math.abs(data.expense),
      percentage: total > 0 ? ((Math.abs(data.expense) / total) * 100).toFixed(1) : '0',
      fill: COLORS.expense,
    },
  ].filter((d) => d.value > 0);

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Recettes vs Dépenses</CardTitle>
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
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Recettes vs Dépenses</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Euro className="h-12 w-12 mb-2 opacity-30" />
            <p className="text-sm">Aucune transaction</p>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            {/* Donut à gauche */}
            <div className="flex-shrink-0 w-2/5">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Détails à droite */}
            <div className="flex-1 space-y-3 text-sm">
              {/* Recettes */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="font-medium text-gray-700">Recettes</span>
                </div>
                <span className="font-semibold text-gray-900">
                  {new Intl.NumberFormat('fr-FR', { 
                    style: 'currency', 
                    currency: 'EUR', 
                    maximumFractionDigits: 0 
                  }).format(data.income)}
                </span>
              </div>

              {/* Dépenses */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="font-medium text-gray-700">Dépenses</span>
                </div>
                <span className="font-semibold text-gray-900">
                  {new Intl.NumberFormat('fr-FR', { 
                    style: 'currency', 
                    currency: 'EUR', 
                    maximumFractionDigits: 0 
                  }).format(Math.abs(data.expense))}
                </span>
              </div>

              {/* Séparateur */}
              <div className="border-t border-gray-200 pt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Euro className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Solde net</span>
                  </div>
                  <Badge 
                    variant={net >= 0 ? "default" : "destructive"}
                    className="text-xs"
                  >
                    {new Intl.NumberFormat('fr-FR', { 
                      style: 'currency', 
                      currency: 'EUR', 
                      maximumFractionDigits: 0 
                    }).format(net)}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

