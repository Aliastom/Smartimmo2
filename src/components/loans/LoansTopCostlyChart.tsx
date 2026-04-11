'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
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
import { AlertCircle } from 'lucide-react';
import { propertyLoansTabHref } from '@/features/loans/components/LoansPortfolioPilotageBar';

const NAV_HINT = 'Voir le détail du financement';

export interface TopCostlyLoan {
  loanId: string;
  /** Pour navigation vers l’onglet Prêts du bien */
  propertyId?: string;
  label: string;
  totalInterest: number;
  borrowers?: Array<{ name: string; pct: number | null }>;
}

interface LoansTopCostlyChartProps {
  data: TopCostlyLoan[];
  isLoading?: boolean;
  onViewMore?: () => void; // Callback pour ouvrir la modal
  /** Navigation vers /app?view=property&…&tab=loans au clic sur une barre / ligne */
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

export function LoansTopCostlyChart({
  data,
  isLoading = false,
  onViewMore,
  financingNavigation = false,
}: LoansTopCostlyChartProps) {
  const router = useRouter();
  const displayedData = data.slice(0, 5);

  const goToPropertyLoans = (propertyId: string | undefined) => {
    if (!financingNavigation || !propertyId) return;
    router.push(propertyLoansTabHref(propertyId));
  };
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top 5 - Coûts les plus élevés</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="animate-pulse text-gray-400">Chargement...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 5 - Coûts les plus élevés</CardTitle>
        <p className="text-sm text-gray-600 mt-1">Intérêts totaux par prêt</p>
      </CardHeader>
      <CardContent className="min-w-0">
        {data.length === 0 ? (
          <div className="space-y-3">
            <div className="h-64 flex flex-col items-center justify-center text-gray-400">
              <AlertCircle className="h-12 w-12 mb-2" />
              <p>Aucune donnée disponible</p>
            </div>
            {onViewMore && (
              <button
                onClick={onViewMore}
                className="w-full text-xs text-gray-500 hover:text-gray-700 text-center py-1 border-t border-gray-100 pt-2 transition-colors"
              >
                Voir tous les prêts →
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="min-w-0">
              <ResponsiveContainer width="100%" height={200}>
              <BarChart data={displayedData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={{ stroke: '#9ca3af' }}
                  angle={-25}
                  textAnchor="end"
                  height={72}
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
            <div className="space-y-2">
              {displayedData.map((item, index) => (
                <div
                  key={item.loanId}
                  className={`border-b border-gray-100 last:border-0 pb-2 last:pb-0 rounded-md ${
                    financingNavigation && item.propertyId
                      ? 'cursor-pointer hover:bg-red-50/50 -mx-1 px-1 transition-colors'
                      : ''
                  }`}
                  onClick={() => goToPropertyLoans(item.propertyId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      goToPropertyLoans(item.propertyId);
                    }
                  }}
                  role={financingNavigation && item.propertyId ? 'button' : undefined}
                  tabIndex={financingNavigation && item.propertyId ? 0 : undefined}
                  title={financingNavigation && item.propertyId ? NAV_HINT : undefined}
                >
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {index + 1}
                      </div>
                      <span className="text-gray-700 font-medium truncate">{item.label}</span>
                    </div>
                    <span className="font-medium text-red-600 flex-shrink-0 ml-2">
                      {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(item.totalInterest)}
                    </span>
                  </div>
                  {/* Répartition des co-emprunteurs */}
                  {item.borrowers && item.borrowers.length > 0 && (
                    <div className="ml-7 mt-1 space-y-0.5">
                      <div className="text-xs text-gray-500">Co-emprunteurs:</div>
                      {item.borrowers.map((borrower, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 truncate">
                            {borrower.name.substring(0, 20)}{borrower.name.length > 20 ? '...' : ''}
                          </span>
                          {borrower.pct !== null && (
                            <span className="font-medium text-gray-700 ml-2 flex-shrink-0">
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
            {onViewMore && (
              <button
                onClick={onViewMore}
                className="w-full text-xs text-gray-500 hover:text-gray-700 text-center py-1 border-t border-gray-100 pt-2 transition-colors"
              >
                Voir tous les prêts →
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

