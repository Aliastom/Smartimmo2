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
import { Activity } from 'lucide-react';

export interface OcrStatusData {
  processed: number; // OCR traité avec succès
  failed: number; // OCR échoué
  pending: number; // En attente OCR/classification
}

interface DocumentsOcrStatusChartProps {
  data: OcrStatusData;
  isLoading?: boolean;
}

// Tooltip personnalisé
const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0];
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 mb-1">{data.name}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Documents:</span>
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

export function DocumentsOcrStatusChart({
  data,
  isLoading = false,
}: DocumentsOcrStatusChartProps) {
  
  const total = data.processed + data.failed + data.pending;
  
  const chartData = [
    {
      name: 'Traités',
      value: data.processed,
      percentage: total > 0 ? ((data.processed / total) * 100).toFixed(1) : '0',
      fill: '#10b981', // green
    },
    {
      name: 'Échoués',
      value: data.failed,
      percentage: total > 0 ? ((data.failed / total) * 100).toFixed(1) : '0',
      fill: '#ef4444', // red
    },
    {
      name: 'En attente',
      value: data.pending,
      percentage: total > 0 ? ((data.pending / total) * 100).toFixed(1) : '0',
      fill: '#f59e0b', // amber
    },
  ].filter(item => item.value > 0); // Ne montrer que les statuts avec des documents

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Statut OCR</CardTitle>
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
        <CardTitle className="text-base font-semibold">Statut OCR</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Activity className="h-12 w-12 mb-2 opacity-30" />
            <p className="text-sm">Aucun document</p>
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
              {/* Traités */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-600 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    Traités
                  </span>
                  <span className="font-semibold text-gray-900">{data.processed}</span>
                </div>
              </div>

              {/* Échoués */}
              {data.failed > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-600 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      Échoués
                    </span>
                    <span className="font-semibold text-gray-900">{data.failed}</span>
                  </div>
                </div>
              )}

              {/* En attente */}
              {data.pending > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-600 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      En attente
                    </span>
                    <span className="font-semibold text-gray-900">{data.pending}</span>
                  </div>
                </div>
              )}

              {/* Taux de succès */}
              <div className="pt-2 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-gray-900 font-medium">Taux de succès</span>
                  <span className="font-bold text-green-600">
                    {total > 0 ? ((data.processed / total) * 100).toFixed(0) : 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

