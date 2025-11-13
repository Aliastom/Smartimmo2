'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Link as LinkIcon } from 'lucide-react';

export interface LinksDistributionData {
  noLinks: number;      // 0 liaison (orphelins)
  oneLink: number;      // 1 liaison
  twoLinks: number;     // 2 liaisons
  threeOrMore: number;  // 3+ liaisons
}

interface DocumentsLinksDistributionChartProps {
  data: LinksDistributionData;
  isLoading?: boolean;
}

export function DocumentsLinksDistributionChart({
  data,
  isLoading = false,
}: DocumentsLinksDistributionChartProps) {
  
  const total = data.noLinks + data.oneLink + data.twoLinks + data.threeOrMore;
  
  const bars = [
    {
      label: 'Aucune liaison',
      count: data.noLinks,
      percentage: total > 0 ? ((data.noLinks / total) * 100).toFixed(1) : '0',
      color: 'bg-red-500',
      textColor: 'text-red-700',
      bgColor: 'bg-red-50',
    },
    {
      label: '1 liaison',
      count: data.oneLink,
      percentage: total > 0 ? ((data.oneLink / total) * 100).toFixed(1) : '0',
      color: 'bg-amber-500',
      textColor: 'text-amber-700',
      bgColor: 'bg-amber-50',
    },
    {
      label: '2 liaisons',
      count: data.twoLinks,
      percentage: total > 0 ? ((data.twoLinks / total) * 100).toFixed(1) : '0',
      color: 'bg-blue-500',
      textColor: 'text-blue-700',
      bgColor: 'bg-blue-50',
    },
    {
      label: '3+ liaisons',
      count: data.threeOrMore,
      percentage: total > 0 ? ((data.threeOrMore / total) * 100).toFixed(1) : '0',
      color: 'bg-green-500',
      textColor: 'text-green-700',
      bgColor: 'bg-green-50',
    },
  ];

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Répartition des liaisons</CardTitle>
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
        <CardTitle className="text-base font-semibold">Répartition des liaisons</CardTitle>
        <p className="text-sm text-gray-600">
          Total: {total} document{total > 1 ? 's' : ''}
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <LinkIcon className="h-12 w-12 mb-2 opacity-30" />
            <p className="text-sm">Aucun document</p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[180px] flex flex-col justify-center">
            {bars.map((bar, index) => (
              <div key={index} className="space-y-0.5">
                {/* Label et pourcentage sur UNE ligne compacte */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-700">{bar.label}</span>
                  <span className="text-gray-900 font-semibold">{bar.count} <span className={bar.textColor}>({bar.percentage}%)</span></span>
                </div>
                
                {/* Barre horizontale plus fine */}
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${bar.color} transition-all duration-300`}
                    style={{ width: `${bar.percentage}%` }}
                  />
                </div>
              </div>
            ))}
            
            {/* Résumé compact */}
            <div className="pt-2 mt-2 border-t border-gray-200">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-700">≥ 1 lien</span>
                <span className="font-bold text-green-600">
                  {total > 0 ? (((data.oneLink + data.twoLinks + data.threeOrMore) / total) * 100).toFixed(0) : 0}%
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

