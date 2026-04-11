'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { propertyLoansTabHref } from '@/features/loans/components/LoansPortfolioPilotageBar';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  TooltipProps,
} from 'recharts';
import { ChevronRight } from 'lucide-react';
import type { TopCostlyLoan } from './LoansTopCostlyChart';

const NAV_HINT = 'Voir le détail du financement';

interface TopCostlyLoansModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: TopCostlyLoan[];
  financingNavigation?: boolean;
}

const CustomTooltip = ({
  active,
  payload,
  showNavHint,
}: TooltipProps<number, string> & { showNavHint?: boolean }) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 mb-2">{data.label}</p>
      <div className="flex justify-between gap-4 mb-2">
        <span className="text-gray-600">Coût total:</span>
        <span className="font-medium text-red-600">
          {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(data.totalInterest)}
        </span>
      </div>
      {showNavHint && data.propertyId && (
        <p className="text-xs text-primary-600 font-medium mt-1 pt-1 border-t border-gray-100">{NAV_HINT}</p>
      )}
      {/* Afficher les co-emprunteurs dans le tooltip */}
      {data.borrowers && data.borrowers.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <div className="text-xs text-gray-500 mb-1">Co-emprunteurs:</div>
          {data.borrowers.map((borrower: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between text-xs">
              <span className="text-gray-600">{borrower.name}</span>
              {borrower.pct !== null && (
                <span className="font-medium text-gray-700 ml-2">{borrower.pct.toFixed(1)}%</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export function TopCostlyLoansModal({
  isOpen,
  onClose,
  data,
  financingNavigation = false,
}: TopCostlyLoansModalProps) {
  const router = useRouter();

  const goToPropertyLoans = (propertyId: string | undefined) => {
    if (!financingNavigation || !propertyId) return;
    onClose();
    router.push(propertyLoansTabHref(propertyId));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Prêts triés par coût total"
      size="lg"
      footer={
        <Button onClick={onClose}>
          Fermer
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Graphique */}
        <div className="min-w-0">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                type="category"
                dataKey="label"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={{ stroke: '#9ca3af' }}
                angle={-20}
                textAnchor="end"
                height={80}
              />
              <YAxis
                type="number"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={{ stroke: '#9ca3af' }}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k€`}
              />
              <Tooltip content={<CustomTooltip showNavHint={financingNavigation} />} />
              <Bar
                dataKey="totalInterest"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
                cursor={financingNavigation ? 'pointer' : undefined}
                onClick={(barData: unknown) => {
                  const row = barData as (TopCostlyLoan & { payload?: TopCostlyLoan }) | undefined;
                  const payload = row?.payload ?? row;
                  goToPropertyLoans(payload?.propertyId);
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Liste détaillée */}
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {data.map((item, index) => (
            <div
              key={item.loanId}
              className={`border-b border-gray-200 last:border-0 pb-3 last:pb-0 rounded-md transition-colors ${
                financingNavigation && item.propertyId
                  ? 'hover:bg-slate-50/90'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between text-sm mb-2 gap-2 px-1">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {index + 1}
                  </div>
                  {financingNavigation && item.propertyId ? (
                    <Link
                      href={propertyLoansTabHref(item.propertyId)}
                      onClick={() => onClose()}
                      className="group inline-flex min-w-0 flex-1 items-center gap-2 cursor-pointer"
                      title={NAV_HINT}
                    >
                      <span className="text-gray-700 font-medium truncate text-left group-hover:text-primary-700 transition-colors">
                        {item.label}
                      </span>
                      <span className="font-medium text-red-600 flex-shrink-0">
                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(item.totalInterest)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-primary-500 transition-colors flex-shrink-0" aria-hidden />
                    </Link>
                  ) : (
                    <>
                      <span className="text-gray-700 font-medium truncate">{item.label}</span>
                      <span className="font-medium text-red-600 flex-shrink-0 ml-auto">
                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(item.totalInterest)}
                      </span>
                    </>
                  )}
                </div>
              </div>
              {/* Répartition des co-emprunteurs */}
              {item.borrowers && item.borrowers.length > 0 && (
                <div className="ml-8 mt-2 space-y-1 px-1">
                  <div className="text-xs text-gray-500 font-medium">Co-emprunteurs:</div>
                  {item.borrowers.map((borrower, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">
                        {borrower.name}
                      </span>
                      {borrower.pct !== null && (
                        <span className="font-medium text-gray-700 ml-2">
                          {borrower.pct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

