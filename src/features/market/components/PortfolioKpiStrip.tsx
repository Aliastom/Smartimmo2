'use client';

import type { ReactNode } from 'react';
import { Calculator, LineChart, Mountain, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/utils/cn';
import type { usePortfolioTracker } from '@/features/market/hooks/usePortfolioTracker';

type Totals = ReturnType<typeof usePortfolioTracker>['totals'];

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

interface KpiItemProps {
  icon: ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}

function KpiItem({ icon, label, value, valueClassName }: KpiItemProps) {
  return (
    <Card className="rounded-2xl border-slate-200/90 bg-white shadow-sm">
      <CardContent className="flex items-start gap-3 p-4 md:p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">{icon}</div>
        <div className="min-w-0 flex-1 text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className={cn('mt-1 text-lg font-semibold tabular-nums text-slate-900 md:text-xl', valueClassName)}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export interface PortfolioKpiStripProps {
  totals: Totals;
  fiscalEstimateEuro: number;
  surplusInflationEuro: number;
  currency: string;
  loading?: boolean;
}

export function PortfolioKpiStrip({
  totals,
  fiscalEstimateEuro,
  surplusInflationEuro,
  currency,
  loading,
}: PortfolioKpiStripProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[96px] min-h-[88px] animate-pulse rounded-2xl border border-slate-100 bg-slate-50" />
        ))}
      </div>
    );
  }

  const latentClass =
    totals.totalUnrealizedPnL > 0
      ? 'text-emerald-700'
      : totals.totalUnrealizedPnL < 0
        ? 'text-rose-700'
        : 'text-slate-700';
  const surplusClass =
    surplusInflationEuro > 0
      ? 'text-emerald-700'
      : surplusInflationEuro < 0
        ? 'text-rose-700'
        : 'text-slate-700';

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiItem
        icon={<Wallet className="h-5 w-5" aria-hidden />}
        label="Investi (coût restant)"
        value={formatCurrency(totals.totalRemainingCostBasis, currency)}
      />
      <KpiItem
        icon={<LineChart className="h-5 w-5" aria-hidden />}
        label="Plus-value latente"
        value={formatCurrency(totals.totalUnrealizedPnL, currency)}
        valueClassName={latentClass}
      />
      <KpiItem
        icon={<Calculator className="h-5 w-5" aria-hidden />}
        label="Impôt total estimé"
        value={formatCurrency(fiscalEstimateEuro, currency)}
      />
      <KpiItem
        icon={<Mountain className="h-5 w-5" aria-hidden />}
        label="Surplus vs inflation"
        value={formatCurrency(surplusInflationEuro, currency)}
        valueClassName={surplusClass}
      />
    </div>
  );
}
