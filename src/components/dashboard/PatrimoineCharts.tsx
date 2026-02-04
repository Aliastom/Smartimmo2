'use client';

import React from 'react';
import { MonthlySeriesItem, RepartitionParBienItem } from '@/types/dashboard';

// ⚠️ OFFLINE-FIRST: Import statique pour éviter ChunkLoadError en mode offline
// Le composant PatrimoineChartsInternal contient Recharts qui doit être disponible localement
import { PatrimoineChartsInternal } from './PatrimoineChartsInternal';

interface PatrimoineChartsProps {
  loyers: MonthlySeriesItem[];
  charges: MonthlySeriesItem[];
  cashflow: MonthlySeriesItem[];
  repartitionParBien: RepartitionParBienItem[];
  repartitionParBienLoyers?: RepartitionParBienItem[];
  repartitionParBienCharges?: RepartitionParBienItem[];
  repartitionParBienCashflow?: RepartitionParBienItem[];
  isLoading?: boolean;
}

export const PatrimoineCharts = React.memo(function PatrimoineCharts({
  loyers,
  charges,
  cashflow,
  repartitionParBien,
  repartitionParBienLoyers,
  repartitionParBienCharges,
  repartitionParBienCashflow,
  isLoading = false,
}: PatrimoineChartsProps) {
  return (
    <PatrimoineChartsInternal
      loyers={loyers}
      charges={charges}
      cashflow={cashflow}
      repartitionParBien={repartitionParBien}
      repartitionParBienLoyers={repartitionParBienLoyers}
      repartitionParBienCharges={repartitionParBienCharges}
      repartitionParBienCashflow={repartitionParBienCashflow}
      isLoading={isLoading}
    />
  );
});

