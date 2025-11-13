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
} from 'recharts';
import { FileText } from 'lucide-react';

export interface MonthlyDocumentData {
  month: string; // Format: 'YYYY-MM'
  count: number; // Nombre de documents uploadés ce mois
}

interface DocumentsMonthlyChartProps {
  data: MonthlyDocumentData[];
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
          <span className="text-gray-600">Documents uploadés:</span>
          <span className="font-medium text-blue-600">
            {data.count}
          </span>
        </div>
      </div>
    </div>
  );
};

export function DocumentsMonthlyChart({
  data,
  isLoading = false,
}: DocumentsMonthlyChartProps) {
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

  const totalDocuments = data.reduce((sum, d) => sum + d.count, 0);

  if (isLoading) {
    return (
      <Card className="w-full col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Évolution mensuelle des documents</CardTitle>
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
            <CardTitle className="text-base font-semibold">Évolution mensuelle des documents</CardTitle>
            <p className="text-sm text-gray-600">
              Total uploadés: {totalDocuments}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <FileText className="h-12 w-12 mb-2 opacity-30" />
            <p className="text-sm">Aucun document sur cette période</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
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
                tickFormatter={(value) => value.toString()}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="count"
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

