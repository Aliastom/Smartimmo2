'use client';

import { useState, useEffect } from 'react';
import { Transaction } from '../domain/entities/Transaction';

interface TransactionSummary {
  income: number;
  expenses: number;
  delta: number;
}

export function useTransactionSummary(transactions: Transaction[]): TransactionSummary {
  const [summary, setSummary] = useState<TransactionSummary>({
    income: 0,
    expenses: 0,
    delta: 0,
  });

  useEffect(() => {
    if (transactions.length === 0) {
      setSummary({
        income: 0,
        expenses: 0,
        delta: 0,
      });
      return;
    }

    const income = transactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = transactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const delta = income - expenses;

    setSummary({
      income,
      expenses,
      delta,
    });
  }, [transactions]);

  return summary;
}
