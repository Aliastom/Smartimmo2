'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

// Import dynamique du composant complet pour éviter les problèmes de chargement
const RechartsChart = dynamic(
  () => import('./LoyersRetardChartInternal'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-gray-500">Chargement du graphique...</div>
      </div>
    ),
  }
);

export interface LoyersRetardChartProps {
  data?: Array<{ month: string; count: number }>;
}

export const LoyersRetardChart = React.memo<LoyersRetardChartProps>(({
  data,
}) => {
  // Utiliser les données fournies ou un tableau vide
  const chartData = data && data.length > 0 ? data : [];

  // Si pas de données, afficher un message
  if (chartData.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base">Évolution des loyers en retard</CardTitle>
        </CardHeader>
        <CardContent className="py-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-sm text-gray-500">Aucun loyer toujours dû</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Évolution des loyers toujours dus</CardTitle>
      </CardHeader>
      <CardContent className="py-6">
        <RechartsChart data={chartData} />
      </CardContent>
    </Card>
  );
});

LoyersRetardChart.displayName = 'LoyersRetardChart';

