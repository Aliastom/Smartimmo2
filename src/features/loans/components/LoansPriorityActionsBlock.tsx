'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import { GLOBAL_ROW_DETAIL_LINK_CLASS } from '@/components/global-pilotage';
import type { Loan } from '@/features/loans/hooks/useLoansData';
import type { LoanPilotagePriorityRow } from '@/features/loans/utils/buildLoanPilotagePriorityItems';

interface LoansPriorityActionsBlockProps {
  rows: LoanPilotagePriorityRow[];
  isLoading?: boolean;
  onAnalyze: (loan: Loan) => void;
  onViewDetail: (loan: Loan) => void;
  formatCurrency: (n: number) => string;
}

export function LoansPriorityActionsBlock({
  rows,
  isLoading = false,
  onAnalyze,
  onViewDetail,
  formatCurrency,
}: LoansPriorityActionsBlockProps) {
  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-red-100/90 bg-white/90 p-3 h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-emerald-900/90 bg-emerald-50/80 border border-emerald-200/80 rounded-lg px-3 py-2.5">
        Aucun crédit ne ressort comme prioritaire sur votre cashflow.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const isNeg = row.badge === 'negative_cf';
        const sharePct =
          row.paymentShareOfCashflow != null ? Math.round(row.paymentShareOfCashflow * 100) : null;

        return (
          <div
            key={row.loan.id}
            className="rounded-lg border border-red-100/90 bg-white/95 p-3 shadow-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <p className="font-semibold text-gray-900 text-base leading-snug truncate">
                    {row.loan.label}
                  </p>
                  <p className="text-sm text-gray-600 truncate">{row.loan.propertyName}</p>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums">
                  <span className="text-gray-600">
                    Mensualité{' '}
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(row.monthlyPayment)}
                    </span>
                  </span>
                  {isNeg ? (
                    <span className="text-gray-700">
                      Impact bien{' '}
                      <span className="font-bold text-red-700">
                        {formatCurrency(row.propertyNetMonthly)}
                      </span>
                      <span className="text-gray-500 font-normal"> / mois</span>
                    </span>
                  ) : (
                    <span className="text-gray-700">
                      Impact{' '}
                      <span className="font-bold text-orange-800">
                        {sharePct != null ? `${sharePct} %` : '—'}
                      </span>
                      <span className="text-gray-500 font-normal"> du cashflow du bien</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 border-t border-red-50 pt-3 sm:border-0 sm:pt-0">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                    isNeg ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-900'
                  )}
                >
                  {isNeg ? 'Cashflow négatif' : 'Mensualité élevée'}
                </span>
                <Button
                  type="button"
                  size="sm"
                  className="bg-orange-600 hover:bg-orange-700 text-white font-semibold min-w-[7rem]"
                  onClick={() => onAnalyze(row.loan)}
                >
                  Analyser
                </Button>
                <button
                  type="button"
                  className={cn(
                    GLOBAL_ROW_DETAIL_LINK_CLASS,
                    'mt-0 pt-0 w-auto sm:text-right self-center sm:self-end'
                  )}
                  onClick={() => onViewDetail(row.loan)}
                >
                  Voir détail
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface LoansPriorityActionsCardProps extends LoansPriorityActionsBlockProps {
  children?: React.ReactNode;
}

export function LoansPriorityActionsCard({
  rows,
  isLoading,
  onAnalyze,
  onViewDetail,
  formatCurrency,
  children,
}: LoansPriorityActionsCardProps) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50/70 shadow-sm p-4 space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <AlertTriangle className="text-red-600 shrink-0 h-5 w-5" />
          <h2 className="text-lg font-bold text-gray-900">Actions à traiter</h2>
        </div>
        <p className="text-sm text-red-950/80 pl-0 sm:pl-7">
          Identifiez les crédits qui dégradent votre rentabilité.
        </p>
      </div>
      <LoansPriorityActionsBlock
        rows={rows}
        isLoading={isLoading}
        onAnalyze={onAnalyze}
        onViewDetail={onViewDetail}
        formatCurrency={formatCurrency}
      />
      {children}
    </div>
  );
}
