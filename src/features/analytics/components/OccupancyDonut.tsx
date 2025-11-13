'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, TooltipProps, Label } from 'recharts';
import { usePropertyFilters } from '@/features/properties/store/usePropertyFilters';
import type { Property } from '../types';
import { Home, UserCheck, UserX } from 'lucide-react';

interface OccupancyDonutProps {
  properties: Property[];
}

const COLORS = {
  occupied: '#10b981', // green-500
  vacant: '#f59e0b',   // amber-500
};

// Tooltip personnalisé
const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0];
  const Icon = data.name === 'Occupés' ? UserCheck : UserX;
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4" style={{ color: data.payload.fill }} />
        <span className="font-semibold text-gray-900">{data.name}</span>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Nombre:</span>
          <span className="font-medium">{data.value} biens</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Pourcentage:</span>
          <span className="font-medium">{data.payload.percentage}%</span>
        </div>
      </div>
    </div>
  );
};

// Label personnalisé au centre
const renderCenterLabel = (occupationRate: number, total: number) => {
  return (
    <g>
      <text
        x="50%"
        y="45%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="14"
        fontWeight="bold"
        fill="#111827"
      >
        {occupationRate}%
      </text>
      <text
        x="50%"
        y="58%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="text-xs fill-gray-500"
      >
        {total} bien{total > 1 ? 's' : ''}
      </text>
    </g>
  );
};

export function OccupancyDonut({ properties }: OccupancyDonutProps) {
  const { selectedPropertyIds, statusFilter, setStatusFilter } = usePropertyFilters();

  // Filtrer les propriétés selon la sélection
  const filteredProperties = useMemo(() => {
    let filtered = properties;

    // Filtrer par propriétés sélectionnées
    if (selectedPropertyIds && selectedPropertyIds.length > 0) {
      filtered = filtered.filter(p => selectedPropertyIds.includes(p.id));
    }

    // Filtrer par statut
    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    return filtered;
  }, [properties, selectedPropertyIds, statusFilter]);

  // Calculer les stats
  const stats = useMemo(() => {
    const total = filteredProperties.length;
    const occupied = filteredProperties.filter((p) => p.status === 'occupied').length;
    const vacant = total - occupied;
    const occupationRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

    return { total, occupied, vacant, occupationRate };
  }, [filteredProperties]);

  // Préparer les données pour le graphique
  const chartData = [
    {
      name: 'Occupés',
      value: stats.occupied,
      percentage: stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0,
      status: 'occupied' as const,
    },
    {
      name: 'Vacants',
      value: stats.vacant,
      percentage: stats.total > 0 ? Math.round((stats.vacant / stats.total) * 100) : 0,
      status: 'vacant' as const,
    },
  ].filter((d) => d.value > 0);

  // Gérer le clic sur une tranche
  const handleClick = (data: any) => {
    const clickedStatus = data.status;
    // Toggle: si déjà sélectionné, revenir à "all", sinon appliquer le filtre
    if (statusFilter === clickedStatus) {
      setStatusFilter('all');
    } else {
      setStatusFilter(clickedStatus);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Taux d'occupation</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {stats.total === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Home className="h-12 w-12 mb-2 opacity-30" />
            <p className="text-sm">Aucun bien disponible</p>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            {/* Donut à gauche (40%) */}
            <div className="flex-shrink-0 w-2/5">
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={50}
                    paddingAngle={2}
                    dataKey="value"
                    onClick={handleClick}
                    style={{ cursor: 'pointer' }}
                  >
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={COLORS[entry.status]}
                        stroke={statusFilter === entry.status ? '#1f2937' : 'transparent'}
                        strokeWidth={statusFilter === entry.status ? 3 : 0}
                        opacity={
                          statusFilter === 'all' || statusFilter === entry.status ? 1 : 0.4
                        }
                      />
                    ))}
                  </Pie>
                  <Label
                    content={renderCenterLabel(stats.occupationRate, stats.total)}
                    position="center"
                  />
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Contenu à droite (60%) */}
            <div className="flex-1 space-y-3">
              {/* Résumé */}
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  {stats.occupied} / {stats.total} occupés
                </p>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="secondary" className="text-xs">
                    {stats.occupationRate}% d'occupation
                  </Badge>
                  {statusFilter !== 'all' && (
                    <button
                      onClick={() => setStatusFilter('all')}
                      className="text-xs text-blue-600 hover:text-blue-700 underline"
                      aria-label="Réinitialiser le filtre"
                    >
                      Réinitialiser
                    </button>
                  )}
                </div>
              </div>

              {/* Légende colorée */}
              <div className="space-y-2">
                <button
                  onClick={() => handleClick({ status: 'occupied' })}
                  className={`flex items-center gap-2 text-sm transition-opacity ${
                    statusFilter === 'all' || statusFilter === 'occupied' ? 'opacity-100' : 'opacity-40'
                  } hover:opacity-100`}
                >
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="font-medium">Occupés ({stats.occupied})</span>
                </button>
                <button
                  onClick={() => handleClick({ status: 'vacant' })}
                  className={`flex items-center gap-2 text-sm transition-opacity ${
                    statusFilter === 'all' || statusFilter === 'vacant' ? 'opacity-100' : 'opacity-40'
                  } hover:opacity-100`}
                >
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="font-medium">Vacants ({stats.vacant})</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

