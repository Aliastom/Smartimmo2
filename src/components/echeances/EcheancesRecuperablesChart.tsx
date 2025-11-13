'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  TooltipProps,
  Legend,
  Cell,
} from 'recharts';
import { DollarSign } from 'lucide-react';

export interface RecuperablesData {
  recuperables: number;
  nonRecuperables: number;
}

interface EcheancesRecuperablesChartProps {
  data: RecuperablesData;
  isLoading?: boolean;
}

const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex justify-between gap-4">
            <span className="text-gray-600">{entry.name}:</span>
            <span className="font-medium" style={{ color: entry.color }}>
              {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(entry.value as number)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export function EcheancesRecuperablesChart({
  data,
  isLoading = false,
}: EcheancesRecuperablesChartProps) {
  const total = data.recuperables + data.nonRecuperables;
  const percentRecuperables = total > 0 ? ((data.recuperables / total) * 100).toFixed(0) : 0;

  const chartData = [
    {
      name: 'Charges',
      'Récupérables': data.recuperables,
      'Non récupérables': data.nonRecuperables,
    },
  ];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Charges récupérables</CardTitle>
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
    <Card>
      <CardHeader>
        <CardTitle>Charges récupérables</CardTitle>
        <p className="text-sm text-gray-600 mt-1">
          {percentRecuperables}% récupérables
        </p>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-gray-400">
            <DollarSign className="h-12 w-12 mb-2" />
            <p>Aucune charge disponible</p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k€`}
                />
                <YAxis type="category" dataKey="name" hide />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="Récupérables" stackId="a" fill="#10b981" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Non récupérables" stackId="a" fill="#6b7280" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-gray-700">Récupérables</span>
                </div>
                <span className="font-medium text-gray-900">
                  {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(data.recuperables)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-500" />
                  <span className="text-gray-700">Non récupérables</span>
                </div>
                <span className="font-medium text-gray-900">
                  {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(data.nonRecuperables)}
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

