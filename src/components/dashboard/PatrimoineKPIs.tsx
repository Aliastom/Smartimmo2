'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { PatrimoineKPIs as KPIs } from '@/types/dashboard';
import { Home, DollarSign, TrendingUp, AlertCircle, Percent } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/utils/cn';

interface PatrimoineKPIsProps {
  kpis: KPIs;
  isLoading?: boolean;
}

export function PatrimoineKPIs({ kpis, isLoading = false }: PatrimoineKPIsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
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
    if (value > 0) return <Badge variant="success" className="text-xs">Positif</Badge>;
    if (value < 0) return <Badge variant="danger" className="text-xs">Négatif</Badge>;
    return <Badge variant="secondary" className="text-xs">Neutre</Badge>;
  };

  const getRendementBadge = (value: number | null) => {
    if (value === null) return null;
    if (value >= 5) return <Badge variant="success" className="text-xs">Bon</Badge>;
    if (value >= 3) return <Badge variant="warning" className="text-xs">Moyen</Badge>;
    return <Badge variant="danger" className="text-xs">Faible</Badge>;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
      {/* Valeur du parc */}
      <StatCard
        title="Valeur du parc"
        value={formatCurrency(kpis.valeurParc)}
        iconName="Home"
        color="primary"
        trend={{ value: 0, label: 'Total immobilier', period: '' }}
      />

      {/* Encours / Dette */}
      <StatCard
        title="Encours / Dette"
        value={formatCurrency(kpis.encoursDette)}
        iconName="AlertCircle"
        color="gray"
        trend={{ value: 0, label: kpis.encoursDette === null ? 'Non disponible' : 'Dette totale', period: '' }}
      />

      {/* Cashflow du mois */}
      <Card className="border border-gray-200">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-2">
            <p className="text-sm font-semibold text-gray-600">Cashflow du mois</p>
            <div className="flex items-center gap-1">
              {getCashflowBadge(kpis.cashflowMois)}
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <p
              className={cn(
                'text-2xl font-semibold',
                kpis.cashflowMois !== null && kpis.cashflowMois > 0
                  ? 'text-green-600'
                  : kpis.cashflowMois !== null && kpis.cashflowMois < 0
                  ? 'text-red-600'
                  : 'text-gray-900'
              )}
            >
              {formatCurrency(kpis.cashflowMois)}
            </p>
            <DollarSign className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-xs text-gray-500 mt-1">Solde mensuel</p>
        </CardContent>
      </Card>

      {/* Cashflow annuel moyen - NOUVEAU */}
      <Card className="border border-gray-200">
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
            <TrendingUp className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-xs text-gray-500 mt-1">Par mois (moyenne)</p>
        </CardContent>
      </Card>

      {/* Rendement net estimé */}
      <Card className="border border-gray-200">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-2">
            <p className="text-sm font-semibold text-gray-600">Rendement net</p>
            <div className="flex items-center gap-1">
              {getRendementBadge(kpis.rendementNet)}
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-semibold text-gray-900">{formatPercent(kpis.rendementNet)}</p>
            <Percent className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-xs text-gray-500 mt-1">Sur la valeur du parc</p>
        </CardContent>
      </Card>

      {/* Vacance */}
      <StatCard
        title="Vacance"
        value={formatPercent(kpis.vacancePct)}
        iconName="AlertCircle"
        color={kpis.vacancePct !== null && kpis.vacancePct > 20 ? 'warning' : 'success'}
        trend={{ value: 0, label: 'Taux d\'occupation', period: '' }}
      />
    </div>
  );
}

