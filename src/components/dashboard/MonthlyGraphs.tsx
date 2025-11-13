'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { IntraMensuelDataPoint, CashflowCumuleDataPoint } from '@/types/dashboard';

export interface MonthlyGraphsProps {
  intraMensuel: IntraMensuelDataPoint[];
  cashflowCumule: CashflowCumuleDataPoint[];
  isLoading?: boolean;
}

export function MonthlyGraphs({
  intraMensuel,
  cashflowCumule,
  isLoading = false,
}: MonthlyGraphsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    });
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-gray-900 mb-2">
            {formatDate(label)}
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-600">{entry.name}:</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-2 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-gray-100 rounded animate-pulse"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Graphique Intra-mensuel : Encaissements vs Dépenses */}
      <Card>
        <CardHeader>
          <CardTitle>Évolution intra-mensuelle</CardTitle>
          <CardDescription>
            Encaissements et dépenses par jour
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={intraMensuel}>
              <defs>
                <linearGradient id="colorEncaissements" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorDepenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                tickMargin={8}
              />
              <YAxis
                tickFormatter={(value) => formatCurrency(value)}
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                width={80}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '14px', paddingTop: '16px' }}
                iconType="circle"
              />
              <Area
                type="monotone"
                dataKey="encaissements"
                name="Encaissements"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#colorEncaissements)"
              />
              <Area
                type="monotone"
                dataKey="depenses"
                name="Dépenses"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#colorDepenses)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Graphique Cashflow cumulé */}
      <Card>
        <CardHeader>
          <CardTitle>Cashflow cumulé du mois</CardTitle>
          <CardDescription>
            Évolution du solde net jour par jour
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={cashflowCumule}>
              <defs>
                <linearGradient id="colorCashflow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                tickMargin={8}
              />
              <YAxis
                tickFormatter={(value) => formatCurrency(value)}
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                width={80}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const value = payload[0].value as number;
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                        <p className="text-sm font-medium text-gray-900 mb-2">
                          {formatDate(label)}
                        </p>
                        <div className="flex items-center gap-2 text-sm">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: value >= 0 ? '#10b981' : '#ef4444' }}
                          />
                          <span className="text-gray-600">Cashflow:</span>
                          <span
                            className="font-semibold"
                            style={{ color: value >= 0 ? '#10b981' : '#ef4444' }}
                          >
                            {formatCurrency(value)}
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '14px', paddingTop: '16px' }}
                iconType="circle"
              />
              <Line
                type="monotone"
                dataKey="cashflow"
                name="Cashflow cumulé"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ r: 3, fill: '#3b82f6' }}
                activeDot={{ r: 5 }}
              />
              {/* Ligne de référence à 0 */}
              <Line
                type="monotone"
                dataKey={() => 0}
                stroke="#6b7280"
                strokeDasharray="5 5"
                strokeWidth={1}
                dot={false}
                legendType="none"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

