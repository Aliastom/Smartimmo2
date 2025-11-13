'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  TooltipProps,
  Legend,
} from 'recharts';
import { Calendar } from 'lucide-react';

export interface CumulativeData {
  period: string; // Format: 'YYYY-MM' ou 'YYYY'
  credits: number;
  debits: number;
  solde: number;
}

interface EcheancesCumulativeChartProps {
  data: CumulativeData[];
  isLoading?: boolean;
  viewMode: 'monthly' | 'yearly';
  onViewModeChange: (mode: 'monthly' | 'yearly') => void;
}

// Tooltip personnalisé
const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 mb-2">{data.periodLabel || data.period}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Crédits:</span>
          <span className="font-medium text-green-600">
            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(data.credits)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Débits:</span>
          <span className="font-medium text-red-600">
            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Math.abs(data.debits))}
          </span>
        </div>
        <div className="flex justify-between gap-4 pt-1 border-t border-gray-200">
          <span className="text-gray-900 font-medium">Solde:</span>
          <span className={`font-bold ${data.solde >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(data.solde)}
          </span>
        </div>
      </div>
    </div>
  );
};

export function EcheancesCumulativeChart({
  data,
  isLoading = false,
  viewMode,
  onViewModeChange,
}: EcheancesCumulativeChartProps) {

  // Formater les labels selon le mode
  const formatLabel = (period: string) => {
    if (viewMode === 'monthly') {
      if (period.includes('-')) {
        const [year, month] = period.split('-');
        const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jui', 'Jui', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
        return monthNames[parseInt(month) - 1];
      }
      return period;
    } else {
      // Mode annuel : afficher juste l'année
      return period.includes('-') ? period.split('-')[0] : period;
    }
  };

  // Préparer les données avec labels courts
  const chartData = data.map((d) => ({
    ...d,
    periodLabel: formatLabel(d.period),
  }));

  const totalSolde = data.length > 0 ? data[data.length - 1].solde : 0;

  if (isLoading) {
    return (
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle>Évolution mensuelle/annuelle</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="animate-pulse text-gray-400">Chargement...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Évolution {viewMode === 'monthly' ? 'mensuelle' : 'annuelle'}</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Solde final: {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(totalSolde)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'monthly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onViewModeChange('monthly')}
            >
              Mois
            </Button>
            <Button
              variant={viewMode === 'yearly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onViewModeChange('yearly')}
            >
              Année
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-gray-400">
            <Calendar className="h-12 w-12 mb-2" />
            <p>Aucune donnée disponible</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="periodLabel"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={{ stroke: '#9ca3af' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={{ stroke: '#9ca3af' }}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k€`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="line"
                formatter={(value) => {
                  const labels: Record<string, string> = {
                    credits: 'Crédits',
                    debits: 'Débits',
                  };
                  return labels[value] || value;
                }}
              />
              <Line
                type="monotone"
                dataKey="credits"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: '#10b981', r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="debits"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ fill: '#ef4444', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

