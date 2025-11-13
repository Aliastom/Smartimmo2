'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { Transaction, Property } from '../types';
import { usePropertyFilters } from '@/features/properties/store/usePropertyFilters';
import { TrendingUp, TrendingDown, Euro } from 'lucide-react';

interface RevenueExpenseCardProps {
  transactions: Transaction[];
  properties: Property[];
  year: number;
}

export function RevenueExpenseCard({ transactions, properties, year }: RevenueExpenseCardProps) {
  const { selectedPropertyIds, statusFilter } = usePropertyFilters();

  // Filtrer les propriétés selon les filtres actifs
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

  // Filtrer les transactions selon les propriétés filtrées et l'année
  const yearTransactions = useMemo(() => {
    const filteredPropertyIds = new Set(filteredProperties.map(p => p.id));
    
    return transactions.filter(t => {
      const transactionYear = new Date(t.date).getFullYear();
      const isCorrectYear = transactionYear === year;
      const isFromFilteredProperty = filteredPropertyIds.has(t.propertyId);
      
      return isCorrectYear && isFromFilteredProperty;
    });
  }, [transactions, filteredProperties, year]);

  // Calculer les totaux
  const totals = useMemo(() => {
    const revenue = yearTransactions
      .filter(t => t.kind === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expense = yearTransactions
      .filter(t => t.kind === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const net = revenue - expense;
    
    return { revenue, expense, net };
  }, [yearTransactions]);

  // Calculer les variations vs année précédente
  const variations = useMemo(() => {
    const prevYearTransactions = transactions.filter(t => {
      const transactionYear = new Date(t.date).getFullYear();
      return transactionYear === year - 1;
    });

    const prevRevenue = prevYearTransactions
      .filter(t => t.kind === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const prevExpense = prevYearTransactions
      .filter(t => t.kind === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const revenueVariation = prevRevenue > 0 ? ((totals.revenue - prevRevenue) / prevRevenue) * 100 : 0;
    const expenseVariation = prevExpense > 0 ? ((totals.expense - prevExpense) / prevExpense) * 100 : 0;

    return { revenueVariation, expenseVariation };
  }, [transactions, year, totals]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getVariationIcon = (variation: number) => {
    if (variation > 0) return <TrendingUp className="h-3 w-3" />;
    if (variation < 0) return <TrendingDown className="h-3 w-3" />;
    return null;
  };

  const getVariationColor = (variation: number) => {
    if (variation > 0) return 'text-green-600';
    if (variation < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Recettes vs Dépenses</CardTitle>
        <p className="text-sm text-gray-600">{year}</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          {/* Recettes */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm font-medium text-gray-700">Recettes</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-gray-900">
                {formatCurrency(totals.revenue)}
              </div>
              {variations.revenueVariation !== 0 && (
                <div className={`flex items-center gap-1 text-xs ${getVariationColor(variations.revenueVariation)}`}>
                  {getVariationIcon(variations.revenueVariation)}
                  <span>{Math.abs(variations.revenueVariation).toFixed(1)}%</span>
                </div>
              )}
            </div>
          </div>

          {/* Dépenses */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-sm font-medium text-gray-700">Dépenses</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-gray-900">
                {formatCurrency(totals.expense)}
              </div>
              {variations.expenseVariation !== 0 && (
                <div className={`flex items-center gap-1 text-xs ${getVariationColor(-variations.expenseVariation)}`}>
                  {getVariationIcon(-variations.expenseVariation)}
                  <span>{Math.abs(variations.expenseVariation).toFixed(1)}%</span>
                </div>
              )}
            </div>
          </div>

          {/* Séparateur */}
          <div className="border-t border-gray-200 pt-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Euro className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Net</span>
              </div>
              <Badge 
                variant={totals.net >= 0 ? "default" : "destructive"}
                className="text-xs"
              >
                {formatCurrency(totals.net)}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
