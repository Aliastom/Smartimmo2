'use client';

import React from 'react';
import { formatMonthYearFR } from '@/utils/format';
import TransactionCard from './TransactionCard';

interface TransactionGroupProps {
  month: string;
  year: number;
  transactions: any[];
  onTransactionClick?: (transaction: any) => void;
  onTransactionView?: (transaction: any) => void;
}

export default function TransactionGroup({ 
  month, 
  year, 
  transactions, 
  onTransactionClick, 
  onTransactionView 
}: TransactionGroupProps) {
  const monthLabel = formatMonthYearFR(year, parseInt(month));

  return (
    <div className="mb-8">
      {/* Header sticky du mois */}
      <div className="sticky top-0 z-10 bg-base-100 border-b border-neutral-200 py-3 mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">
            {monthLabel}
          </h2>
          <span className="text-sm text-neutral-500">
            {transactions.length} transaction{transactions.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Grid des cartes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {transactions.map((transaction) => (
          <TransactionCard
            key={transaction.id}
            transaction={transaction}
            onClick={onTransactionClick}
            onView={onTransactionView}
          />
        ))}
      </div>
    </div>
  );
}
