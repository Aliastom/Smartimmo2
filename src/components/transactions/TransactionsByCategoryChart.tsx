'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  TooltipProps,
  Legend,
} from 'recharts';
import { Tag } from 'lucide-react';

export interface CategoryData {
  category: string;
  amount: number;
  color?: string;
}

interface TransactionsByCategoryChartProps {
  data: CategoryData[];
  isLoading?: boolean;
}

// Palette de couleurs
const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#6366f1', // indigo
];

// Tooltip personnalisé
const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0];
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <div className="flex items-center gap-2 mb-1">
        <div 
          className="w-3 h-3 rounded-full" 
          style={{ backgroundColor: data.payload.fill }}
        />
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

export function TransactionsByCategoryChart({
  data,
  isLoading = false,
}: TransactionsByCategoryChartProps) {
  // Calculer le total et les pourcentages
  const total = data.reduce((sum, d) => sum + d.amount, 0);
  
  const chartData = data.map((d, index) => ({
    name: d.Category,
    value: d.amount,
    percentage: total > 0 ? ((d.amount / total) * 100).toFixed(1) : '0',
    fill: d.color || COLORS[index % COLORS.length],
  }));

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Répartition par catégorie</CardTitle>
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
        <CardTitle className="text-base font-semibold">Répartition par catégorie</CardTitle>
        <p className="text-sm text-gray-600">
          Total: {new Intl.NumberFormat('fr-FR', { 
            style: 'currency', 
            currency: 'EUR', 
            maximumFractionDigits: 0 
          }).format(total)}
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Tag className="h-12 w-12 mb-2 opacity-30" />
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

            {/* Légende à droite */}
            <div className="flex-1 max-h-[180px] overflow-y-auto space-y-2 text-sm">
              {chartData.map((entry, index) => (
                <div key={index} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: entry.fill }}
                    />
                    <span className="truncate text-gray-700">{entry.name}</span>
                  </div>
                  <span className="font-medium text-gray-900 flex-shrink-0">
                    {entry.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

