'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Euro, Wallet, TrendingUp } from 'lucide-react';

export interface DepositsRentsData {
  totalDeposits: number;
  monthlyTotal: number;
  yearlyTotal: number;
}

interface LeasesDepositsRentsChartProps {
  data: DepositsRentsData;
  isLoading?: boolean;
}

export function LeasesDepositsRentsChart({
  data,
  isLoading = false,
}: LeasesDepositsRentsChartProps) {
  const [rentPeriod, setRentPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const currentRentTotal = rentPeriod === 'monthly' ? data.monthlyTotal : data.yearlyTotal;

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Cautions & Loyers cumulés</CardTitle>
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
        <CardTitle className="text-base font-semibold">Cautions & Loyers cumulés</CardTitle>
        <p className="text-sm text-gray-600">
          Informations financières des baux actifs
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Cautions totales */}
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-100 rounded-lg">
                <Wallet className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-blue-900">Total cautions</p>
              </div>
            </div>
            <p className="text-lg font-bold text-blue-900">
              {new Intl.NumberFormat('fr-FR', { 
                style: 'currency', 
                currency: 'EUR', 
                maximumFractionDigits: 0 
              }).format(data.totalDeposits)}
            </p>
          </div>

          {/* Loyers cumulés avec toggle */}
          <div className="p-3 bg-green-50 rounded-lg border border-green-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-green-100 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
                <p className="text-xs font-medium text-green-900">Loyers cumulés</p>
              </div>
              
              {/* Toggle Mensuel/Annuel */}
              <div className="flex items-center gap-0.5 bg-white rounded-md p-0.5 border border-green-200">
                <button
                  onClick={() => setRentPeriod('monthly')}
                  className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                    rentPeriod === 'monthly'
                      ? 'bg-green-500 text-white'
                      : 'text-green-700 hover:text-green-900'
                  }`}
                >
                  Mensuel
                </button>
                <button
                  onClick={() => setRentPeriod('yearly')}
                  className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                    rentPeriod === 'yearly'
                      ? 'bg-green-500 text-white'
                      : 'text-green-700 hover:text-green-900'
                  }`}
                >
                  Annuel
                </button>
              </div>
            </div>
            
            <p className="text-lg font-bold text-green-900 text-right">
              {new Intl.NumberFormat('fr-FR', { 
                style: 'currency', 
                currency: 'EUR', 
                maximumFractionDigits: 0 
              }).format(currentRentTotal)}
            </p>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}

