'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
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
import type { TopCostlyLoan } from './LoansTopCostlyChart';

interface TopCostlyLoansModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: TopCostlyLoan[];
}

const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
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
}: TopCostlyLoansModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Top 5 - Coûts les plus élevés"
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
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="totalInterest" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Liste détaillée */}
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {data.map((item, index) => (
            <div key={item.loanId} className="border-b border-gray-200 last:border-0 pb-3 last:pb-0">
              <div className="flex items-center justify-between text-sm mb-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {index + 1}
                  </div>
                  <span className="text-gray-700 font-medium">{item.label}</span>
                </div>
                <span className="font-medium text-red-600 flex-shrink-0 ml-2">
                  {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(item.totalInterest)}
                </span>
              </div>
              {/* Répartition des co-emprunteurs */}
              {item.borrowers && item.borrowers.length > 0 && (
                <div className="ml-8 mt-2 space-y-1">
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

