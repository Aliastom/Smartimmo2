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
} from 'recharts';
import { AlertCircle } from 'lucide-react';

export interface TopCostlyLoan {
  loanId: string;
  label: string;
  totalInterest: number;
}

interface LoansTopCostlyChartProps {
  data: TopCostlyLoan[];
  isLoading?: boolean;
}

const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 mb-2">{data.label}</p>
      <div className="flex justify-between gap-4">
        <span className="text-gray-600">Coût total:</span>
        <span className="font-medium text-red-600">
          {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(data.totalInterest)}
        </span>
      </div>
    </div>
  );
};

export function LoansTopCostlyChart({
  data,
  isLoading = false,
}: LoansTopCostlyChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top 5 - Coûts les plus élevés</CardTitle>
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
        <CardTitle>Top 5 - Coûts les plus élevés</CardTitle>
        <p className="text-sm text-gray-600 mt-1">Intérêts totaux par prêt</p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-gray-400">
            <AlertCircle className="h-12 w-12 mb-2" />
            <p>Aucune donnée disponible</p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={{ stroke: '#9ca3af' }}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  type="number"
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  tickLine={{ stroke: '#9ca3af' }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k€`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="totalInterest" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {data.map((item, index) => (
                <div key={item.loanId} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </div>
                    <span className="text-gray-700">{item.label}</span>
                  </div>
                  <span className="font-medium text-red-600">
                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(item.totalInterest)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

