'use client';

import React from 'react';
import { Receipt, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import StatCard from '../StatCard';
import StatCardsRow from '../StatCardsRow';
import { useTransactionStats } from '../../hooks/useTransactionStats';
import { formatCurrencyEUR } from '@/utils/format';

interface TransactionStatsCardsProps {
  propertyId?: string;
  month?: number;
  year?: number;
  dateFrom?: string;
  dateTo?: string;
  onFilterClick?: (filterType: string) => void;
}

export default function TransactionStatsCards({ 
  propertyId, 
  month, 
  year, 
  dateFrom, 
  dateTo,
  onFilterClick 
}: TransactionStatsCardsProps) {
  const { data: stats, isLoading, error } = useTransactionStats({ propertyId, month, year, dateFrom, dateTo });

  if (error) {
    console.error('Error loading transaction stats:', error);
  }

  return (
    <StatCardsRow>
      <StatCard
        title="Transactions totales"
        value={isLoading ? '...' : (stats?.totalTransactions || 0)}
        subtitle="Période sélectionnée"
        icon={Receipt}
        iconColor="text-primary"
        iconBgColor="bg-blue-100"
        isLoading={isLoading}
      />
      <StatCard
        title="Loyers encaissés"
        value={isLoading ? '...' : formatCurrencyEUR(stats?.rentReceived || 0)}
        subtitle="Revenus locatifs"
        icon={TrendingUp}
        iconColor="text-success"
        iconBgColor="bg-green-100"
        isLoading={isLoading}
        onClick={onFilterClick ? () => onFilterClick('rent-received') : undefined}
      />
      <StatCard
        title="Charges payées"
        value={isLoading ? '...' : formatCurrencyEUR(stats?.chargesPaid || 0)}
        subtitle="Dépenses"
        icon={TrendingDown}
        iconColor="text-orange-600"
        iconBgColor="bg-orange-100"
        isLoading={isLoading}
        onClick={onFilterClick ? () => onFilterClick('charges-paid') : undefined}
      />
      <StatCard
        title="Solde période"
        value={isLoading ? '...' : formatCurrencyEUR(stats?.balance || 0)}
        subtitle={(stats?.balance || 0) >= 0 ? 'Positif' : 'Négatif'}
        icon={DollarSign}
        iconColor={(stats?.balance || 0) >= 0 ? 'text-emerald-600' : 'text-error'}
        iconBgColor={(stats?.balance || 0) >= 0 ? 'bg-emerald-100' : 'bg-red-100'}
        isLoading={isLoading}
      />
    </StatCardsRow>
  );
}

