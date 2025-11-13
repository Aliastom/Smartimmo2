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
import { Building2 } from 'lucide-react';

export interface PropertyData {
  propertyName: string;
  crd: number;
  propertyId: string;
}

interface LoansByPropertyChartProps {
  data: PropertyData[];
  isLoading?: boolean;
}

const CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
];

const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 mb-2">{data.propertyName}</p>
      <div className="flex justify-between gap-4">
        <span className="text-gray-600">CRD:</span>
        <span className="font-medium">
          {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(data.crd)}
        </span>
      </div>
    </div>
  );
};

export function LoansByPropertyChart({
  data,
  isLoading = false,
}: LoansByPropertyChartProps) {
  const total = data.reduce((sum, item) => sum + item.crd, 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Répartition par Bien</CardTitle>
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
        <CardTitle>Répartition par Bien</CardTitle>
        <p className="text-sm text-gray-600 mt-1">
          CRD Total: {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(total)}
        </p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-gray-400">
            <Building2 className="h-12 w-12 mb-2" />
            <p>Aucune donnée disponible</p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="crd"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {data.map((item, index) => (
                <div key={item.propertyId} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <span className="text-gray-700">{item.propertyName}</span>
                  </div>
                  <span className="font-medium text-gray-900">
                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(item.crd)}
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

