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
} from 'recharts';
import { Sofa } from 'lucide-react';

export interface FurnishedData {
  label: string; // 'Vide', 'Meublé', 'Colocation meublée', etc.
  count: number;
  color?: string;
}

interface LeasesByFurnishedChartProps {
  data: FurnishedData[];
  isLoading?: boolean;
}

// Palette de couleurs pour le meublé
const DEFAULT_COLORS: Record<string, string> = {
  'Vide': '#94a3b8', // slate
  'Meublé': '#3b82f6', // blue
  'Colocation meublée': '#8b5cf6', // purple
  'Colocation vide': '#64748b', // slate dark
};

const FALLBACK_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
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
          <span className="text-gray-600">Nombre de baux:</span>
          <span className="font-medium">{data.value}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Pourcentage:</span>
          <span className="font-medium">{data.payload.percentage}%</span>
        </div>
      </div>
    </div>
  );
};

export function LeasesByFurnishedChart({
  data,
  isLoading = false,
}: LeasesByFurnishedChartProps) {
  // Calculer le total et les pourcentages
  const total = data.reduce((sum, d) => sum + d.count, 0);
  
  const chartData = data.map((d, index) => ({
    name: d.label,
    value: d.count,
    percentage: total > 0 ? ((d.count / total) * 100).toFixed(1) : '0',
    fill: d.color || DEFAULT_COLORS[d.label] || FALLBACK_COLORS[index % FALLBACK_COLORS.length],
  }));

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Répartition par type de meublé</CardTitle>
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
        <CardTitle className="text-base font-semibold">Répartition par type de meublé</CardTitle>
        <p className="text-sm text-gray-600">
          Total: {total} baux actifs
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        {data.length === 0 || total === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Sofa className="h-12 w-12 mb-2 opacity-30" />
            <p className="text-sm">Aucun bail actif</p>
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
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-medium text-gray-900">{entry.value}</span>
                    <span className="text-gray-500">({entry.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

