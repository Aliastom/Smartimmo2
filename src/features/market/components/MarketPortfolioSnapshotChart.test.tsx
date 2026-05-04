import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { PortfolioSnapshot } from '@/features/market/portfolio/portfolioTypes';
import { MarketPortfolioSnapshotChart } from '@/features/market/components/MarketPortfolioSnapshotChart';

/** Données passées à Recharts `LineChart` (capturées par le mock). */
let lastLineChartData: { valeur: number }[] | undefined;

vi.mock('recharts', () => {
  const Passthrough = () => null;
  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    LineChart: ({ data }: { data: { valeur: number }[] }) => {
      lastLineChartData = data;
      return null;
    },
    CartesianGrid: Passthrough,
    Legend: Passthrough,
    Line: Passthrough,
    Tooltip: Passthrough,
    XAxis: Passthrough,
    YAxis: Passthrough,
  };
});

function baseSnap(
  partial: Partial<PortfolioSnapshot> & Pick<PortfolioSnapshot, 'capturedAt' | 'totalMarketValue' | 'id'>
): PortfolioSnapshot {
  return {
    organizationId: 'org',
    totalRemainingCostBasis: 0,
    totalUnrealizedPnL: 0,
    totalRealizedPnL: 0,
    totalDividendsNet: 0,
    grossPerformanceEuro: 0,
    netPerformanceAfterTaxEuro: 0,
    surplusInflationEuro: 0,
    valuationIncomplete: false,
    createdAt: partial.capturedAt,
    ...partial,
  };
}

describe('MarketPortfolioSnapshotChart', () => {
  it('scénario achat puis suppression : le dernier point de la courbe suit le dernier instantané (valeur 0)', () => {
    lastLineChartData = undefined;
    const t1 = '2026-05-04T10:00:00.000Z';
    const t2 = '2026-05-04T10:30:00.000Z';
    const afterBuy = baseSnap({
      id: 'a',
      capturedAt: t1,
      totalMarketValue: 1500,
    });
    const afterDelete = baseSnap({
      id: 'b',
      capturedAt: t2,
      totalMarketValue: 0,
    });

    render(<MarketPortfolioSnapshotChart snapshots={[afterBuy, afterDelete]} currency="EUR" />);

    expect(lastLineChartData).toBeDefined();
    expect(lastLineChartData!.length).toBe(2);
    expect(lastLineChartData!.at(-1)!.valeur).toBe(0);
  });
});
