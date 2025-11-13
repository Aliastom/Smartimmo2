'use client';

import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, Percent, Home, PieChart } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { formatCurrencyEUR } from '@/utils/format';

interface PortfolioSummary {
  patrimoineBrut: number;
  dettes: number;
  patrimoineNet: number;
  ltv: number;
  cashflowAnnuel: number;
  repartitions: {
    parVille: Record<string, { nombre: number; valeur: number }>;
    parType: Record<string, { nombre: number; valeur: number }>;
    parOccupation: Record<string, { nombre: number; valeur: number }>;
  };
  biens: Array<{
    id: string;
    name: string;
    valeurMarche: number;
    crd: number;
    equity: number;
    rendementBrut: number;
    capRate: number;
    tauxOccupation: number;
  }>;
}

export default function PatrimoinePage() {
  const { data: summary, isLoading } = useQuery<PortfolioSummary>({
    queryKey: ['portfolio-summary'],
    queryFn: async () => {
      const response = await fetch('/api/portfolio/summary');
      if (!response.ok) throw new Error('Failed to fetch portfolio summary');
      return response.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-8">
        <h2 className="text-3xl font-bold text-neutral-900">Patrimoine</h2>
        <div className="text-center py-8">Chargement...</div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="space-y-8">
        <h2 className="text-3xl font-bold text-neutral-900">Patrimoine</h2>
        <div className="text-center py-8 text-neutral-500">Aucune donnée disponible</div>
      </div>
    );
  }

  const isPositive = summary.patrimoineNet > 0;

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-neutral-900">Tableau de bord Patrimoine</h2>

      {/* Cartes KPI principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Patrimoine brut */}
        <div className="bg-base-100 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-neutral-600">Patrimoine brut</h3>
            <Home className="w-5 h-5 text-primary" />
          </div>
          <p className="text-2xl font-bold text-neutral-900">
            {formatCurrencyEUR(summary.patrimoineBrut)}
          </p>
          <p className="text-xs text-neutral-500 mt-1">Valeur marché totale</p>
        </div>

        {/* Dettes */}
        <div className="bg-base-100 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-neutral-600">Dettes</h3>
            <TrendingDown className="w-5 h-5 text-error" />
          </div>
          <p className="text-2xl font-bold text-neutral-900">
            {formatCurrencyEUR(summary.dettes)}
          </p>
          <p className="text-xs text-neutral-500 mt-1">Capital restant dû</p>
        </div>

        {/* Patrimoine net */}
        <div className={`bg-base-100 rounded-lg shadow p-6 ${isPositive ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-neutral-600">Patrimoine net</h3>
            <DollarSign className={`w-5 h-5 ${isPositive ? 'text-success' : 'text-error'}`} />
          </div>
          <p className={`text-2xl font-bold ${isPositive ? 'text-success' : 'text-error'}`}>
            {formatCurrencyEUR(summary.patrimoineNet)}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            Après dettes et frais de sortie
          </p>
        </div>

        {/* LTV */}
        <div className="bg-base-100 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-neutral-600">LTV</h3>
            <Percent className="w-5 h-5 text-orange-600" />
          </div>
          <p className={`text-2xl font-bold ${summary.ltv > 80 ? 'text-error' : summary.ltv > 50 ? 'text-orange-600' : 'text-success'}`}>
            {summary.ltv.toFixed(1)}%
          </p>
          <p className="text-xs text-neutral-500 mt-1">Loan to Value</p>
        </div>
      </div>

      {/* Cashflow */}
      <div className="bg-base-100 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-neutral-900">Cashflow annuel</h3>
          {summary.cashflowAnnuel > 0 ? (
            <TrendingUp className="w-5 h-5 text-success" />
          ) : (
            <TrendingDown className="w-5 h-5 text-error" />
          )}
        </div>
        <p className={`text-3xl font-bold ${summary.cashflowAnnuel > 0 ? 'text-success' : 'text-error'}`}>
          {formatCurrencyEUR(summary.cashflowAnnuel)}
        </p>
        <p className="text-sm text-neutral-500 mt-1">
          Loyers encaissés - Mensualités de prêts
        </p>
      </div>

      {/* Répartitions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Par ville */}
        <div className="bg-base-100 rounded-lg shadow p-6">
          <div className="flex items-center space-x-2 mb-4">
            <PieChart className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-neutral-900">Par ville</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(summary.repartitions.parVille).map(([ville, data]) => (
              <div key={ville} className="flex items-center justify-between">
                <span className="text-sm text-neutral-700">{ville}</span>
                <div className="text-right">
                  <div className="text-sm font-medium text-neutral-900">
                    {formatCurrencyEUR(data.valeur)}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {data.nombre} bien{data.nombre > 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Par type */}
        <div className="bg-base-100 rounded-lg shadow p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Home className="w-5 h-5 text-success" />
            <h3 className="text-lg font-semibold text-neutral-900">Par type</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(summary.repartitions.parType).map(([type, data]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-sm text-neutral-700 capitalize">{type}</span>
                <div className="text-right">
                  <div className="text-sm font-medium text-neutral-900">
                    {formatCurrencyEUR(data.valeur)}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {data.nombre} bien{data.nombre > 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Par occupation */}
        <div className="bg-base-100 rounded-lg shadow p-6">
          <div className="flex items-center space-x-2 mb-4">
            <DollarSign className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-neutral-900">Par occupation</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(summary.repartitions.parOccupation).map(([occupation, data]) => (
              <div key={occupation} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${
                    occupation === 'PRINCIPALE' ? 'bg-primary' :
                    occupation === 'LOCATIF' ? 'bg-success' :
                    occupation === 'SECONDAIRE' ? 'bg-purple-500' :
                    occupation === 'USAGE_PRO' ? 'bg-orange-500' :
                    'bg-base-300'
                  }`} />
                  <span className="text-sm text-neutral-700">{occupation}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-neutral-900">
                    {formatCurrencyEUR(data.valeur)}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {data.nombre} bien{data.nombre > 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tableau des biens */}
      <div className="bg-base-100 rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b border-neutral-200">
          <h3 className="text-lg font-semibold text-neutral-900">Détails par bien</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Bien
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Valeur marché
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  CRD
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Equity
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Rend. brut
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Cap rate
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Taux occup.
                </th>
              </tr>
            </thead>
            <tbody className="bg-base-100 divide-y divide-neutral-200">
              {summary.biens.map((bien) => (
                <tr key={bien.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900">
                    {bien.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-neutral-900">
                    {formatCurrencyEUR(bien.valeurMarche)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-neutral-900">
                    {formatCurrencyEUR(bien.crd)}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                    bien.equity > 0 ? 'text-success' : 'text-error'
                  }`}>
                    {formatCurrencyEUR(bien.equity)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-neutral-900">
                    {bien.rendementBrut.toFixed(2)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-neutral-900">
                    {bien.capRate.toFixed(2)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-neutral-900">
                    {bien.tauxOccupation.toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

