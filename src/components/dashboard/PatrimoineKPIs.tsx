'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { PatrimoineKPIs as KPIs } from '@/types/dashboard';
import { Home, TrendingUp, AlertCircle, Percent } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/utils/cn';

interface PatrimoineKPIsProps {
  kpis: KPIs;
  isLoading?: boolean;
}

export function PatrimoineKPIs({ kpis, isLoading = false }: PatrimoineKPIsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-5">
              <div className="h-20 bg-gray-200 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const formatCurrency = (value: number | null) => {
    if (value === null) return '—';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number | null) => {
    if (value === null) return '—';
    return `${value.toFixed(1)}%`;
  };

  const getCashflowBadge = (value: number | null) => {
    if (value === null) return null;
    if (value > 0) return <Badge variant="success" className="text-xs font-medium px-2 py-0.5 bg-emerald-100 text-emerald-800 border-emerald-200">Positif</Badge>;
    if (value < 0) return <Badge variant="danger" className="text-xs font-medium px-2 py-0.5 bg-red-100 text-red-800 border-red-200">Négatif</Badge>;
    return <Badge variant="secondary" className="text-xs font-medium px-2 py-0.5">Neutre</Badge>;
  };

  const getRendementBadge = (value: number | null) => {
    if (value === null) return null;
    if (value >= 5) return <Badge variant="success" className="text-xs font-medium px-2 py-0.5 bg-emerald-100 text-emerald-800 border-emerald-200">Bon</Badge>;
    if (value >= 3) return <Badge variant="warning" className="text-xs font-medium px-2 py-0.5">Moyen</Badge>;
    return <Badge variant="danger" className="text-xs font-medium px-2 py-0.5 bg-red-100 text-red-800 border-red-200">Faible</Badge>;
  };

  const cardHover = 'transition-all duration-200 hover:shadow-md hover:-translate-y-0.5';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {/* Valeur du parc → bleu */}
      <StatCard
        title="Valeur du parc"
        value={formatCurrency(kpis.valeurParc)}
        iconName="Home"
        color="primary"
        trend={{ value: 0, label: 'Total immobilier', period: '' }}
        className={cardHover}
      />

      {/* Encours / Dette → gris */}
      <StatCard
        title="Encours / Dette"
        value={formatCurrency(kpis.encoursDette)}
        iconName="AlertCircle"
        color="gray"
        trend={{ value: 0, label: kpis.encoursDette === null ? 'Non disponible' : 'Dette totale', period: '' }}
        className={cardHover}
      />

      {/* Cashflow moyen → vert */}
      <Card className={`border-l-4 border-l-emerald-500 border border-gray-200 ${cardHover}`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-2">
            <p className="text-sm font-semibold text-gray-600">Cashflow moyen</p>
            <div className="flex items-center gap-1">
              {getCashflowBadge(kpis.cashflowAnnuelMoyen)}
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <p
              className={cn(
                'text-2xl font-semibold',
                kpis.cashflowAnnuelMoyen !== null && kpis.cashflowAnnuelMoyen > 0
                  ? 'text-green-600'
                  : kpis.cashflowAnnuelMoyen !== null && kpis.cashflowAnnuelMoyen < 0
                  ? 'text-red-600'
                  : 'text-gray-900'
              )}
            >
              {formatCurrency(kpis.cashflowAnnuelMoyen)}
            </p>
            <TrendingUp className="h-6 w-6 text-gray-400 shrink-0" />
          </div>
          <p className="text-xs text-gray-500 mt-1">Moyenne mensuelle</p>
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
            <span>↑ Évolution</span>
            <span className="tabular-nums">—</span>
          </p>
        </CardContent>
      </Card>

      {/* Rendement net → orange */}
      <Card className={`border-l-4 border-l-amber-500 border border-gray-200 ${cardHover}`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-2">
            <p className="text-sm font-semibold text-gray-600">Rendement net</p>
            <div className="flex items-center gap-1">
              {getRendementBadge(kpis.rendementNet)}
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-semibold text-gray-900">{formatPercent(kpis.rendementNet)}</p>
            <Percent className="h-6 w-6 text-gray-400 shrink-0" />
          </div>
          <p className="text-xs text-gray-500 mt-1">Sur la valeur du parc</p>
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
            <span>↑ Évolution</span>
            <span className="tabular-nums">—</span>
          </p>
        </CardContent>
      </Card>

      {/* Vacance → rouge si élevé */}
      <StatCard
        title="Vacance"
        value={formatPercent(kpis.vacancePct)}
        iconName="AlertCircle"
        color={kpis.vacancePct !== null && kpis.vacancePct > 20 ? 'red' : 'success'}
        trend={{ value: 0, label: 'Taux d\'occupation', period: '' }}
        className={cardHover}
      />
    </div>
  );
}

