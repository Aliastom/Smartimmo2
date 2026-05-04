import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { PortfolioSnapshot } from '@/features/market/portfolio/portfolioTypes';

vi.mock('@/features/market/portfolio/portfolioPriceLookup', () => ({
  fetchPortfolioPriceLookup: vi.fn(() => Promise.resolve({ bySymbol: {}, metaBySymbol: {} })),
}));
import {
  PORTFOLIO_SNAPSHOT_STALE_MS,
  hasPortfolioSnapshotInSameLocalHour,
  hasRecentPortfolioSnapshot,
  portfolioTotalValueVolatilityRatio,
  shouldTriggerVolatilitySnapshot,
} from '@/features/market/portfolio/portfolioSnapshotGuards';

function snap(partial: Partial<PortfolioSnapshot> & Pick<PortfolioSnapshot, 'capturedAt' | 'totalMarketValue'>): PortfolioSnapshot {
  const base: PortfolioSnapshot = {
    id: '1',
    organizationId: 'org',
    capturedAt: partial.capturedAt,
    createdAt: partial.capturedAt,
    totalMarketValue: partial.totalMarketValue,
    totalRemainingCostBasis: 0,
    totalUnrealizedPnL: 0,
    totalRealizedPnL: 0,
    totalDividendsNet: 0,
    grossPerformanceEuro: 0,
    netPerformanceAfterTaxEuro: 0,
    surplusInflationEuro: 0,
    valuationIncomplete: false,
  };
  return { ...base, ...partial };
}

describe('portfolioSnapshotGuards', () => {
  describe('hasRecentPortfolioSnapshot', () => {
    it('retourne false sans instantané', () => {
      expect(hasRecentPortfolioSnapshot([], Date.now(), PORTFOLIO_SNAPSHOT_STALE_MS)).toBe(false);
    });

    it('retourne true si le dernier instantané date de moins de 12 h', () => {
      const nowMs = Date.parse('2026-05-04T12:00:00.000Z');
      const sn = [
        snap({
          capturedAt: new Date(nowMs - 6 * 60 * 60 * 1000).toISOString(),
          totalMarketValue: 1000,
        }),
      ];
      expect(hasRecentPortfolioSnapshot(sn, nowMs, PORTFOLIO_SNAPSHOT_STALE_MS)).toBe(true);
    });

    it('retourne false si le dernier instantané date de plus de 12 h', () => {
      const nowMs = Date.parse('2026-05-04T12:00:00.000Z');
      const sn = [
        snap({
          capturedAt: new Date(nowMs - 13 * 60 * 60 * 1000).toISOString(),
          totalMarketValue: 1000,
        }),
      ];
      expect(hasRecentPortfolioSnapshot(sn, nowMs, PORTFOLIO_SNAPSHOT_STALE_MS)).toBe(false);
    });
  });

  describe('hasPortfolioSnapshotInSameLocalHour', () => {
    it('détecte un instantané dans la même heure locale', () => {
      const nowMs = Date.parse('2026-05-04T14:35:00.000Z');
      const sn = [snap({ capturedAt: new Date(nowMs - 5 * 60 * 1000).toISOString(), totalMarketValue: 1 })];
      expect(hasPortfolioSnapshotInSameLocalHour(sn, nowMs)).toBe(true);
    });
  });

  describe('volatilité', () => {
    it('pas de déclenchement sans historique', () => {
      expect(shouldTriggerVolatilitySnapshot([], 1100)).toBe(false);
    });

    it('déclenche si variation > 2 %', () => {
      const sn = [snap({ capturedAt: '2026-05-01T10:00:00.000Z', totalMarketValue: 10_000 })];
      expect(shouldTriggerVolatilitySnapshot(sn, 10_300)).toBe(true);
    });

    it('ne déclenche pas sous 2 %', () => {
      const sn = [snap({ capturedAt: '2026-05-01T10:00:00.000Z', totalMarketValue: 10_000 })];
      expect(shouldTriggerVolatilitySnapshot(sn, 10_100)).toBe(false);
    });

    it('ratio null si ancienne valeur nulle', () => {
      expect(portfolioTotalValueVolatilityRatio(0, 100)).toBeNull();
    });
  });
});

describe('createPortfolioSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('journalier : skip si instantané récent (<12h)', async () => {
    const { createPortfolioSnapshot } = await import('@/features/market/portfolio/createPortfolioSnapshot');
    const { portfolioStorage } = await import('@/features/market/portfolio/portfolioStorage');

    const nowMs = Date.now();
    vi.spyOn(portfolioStorage, 'listSnapshots').mockResolvedValue([
      snap({
        capturedAt: new Date(nowMs - 60 * 60 * 1000).toISOString(),
        totalMarketValue: 5000,
      }),
    ]);

    const r = await createPortfolioSnapshot({
      organizationId: 'org',
      settings: null,
      mode: 'auto',
      autoKind: 'daily',
    });

    expect(r.status).toBe('skipped');
    if (r.status === 'skipped') expect(r.reason).toBe('snapshot_within_12h');
  });

  it('auto ordre : enregistre un instantané si liste vide', async () => {
    const { createPortfolioSnapshot } = await import('@/features/market/portfolio/createPortfolioSnapshot');
    const { portfolioStorage } = await import('@/features/market/portfolio/portfolioStorage');

    vi.spyOn(portfolioStorage, 'listSnapshots').mockResolvedValue([]);
    vi.spyOn(portfolioStorage, 'listAccounts').mockResolvedValue([]);
    vi.spyOn(portfolioStorage, 'listOrders').mockResolvedValue([]);
    const saveSpy = vi.spyOn(portfolioStorage, 'saveSnapshot').mockResolvedValue();

    const r = await createPortfolioSnapshot({
      organizationId: 'org',
      settings: null,
      mode: 'auto',
      autoKind: 'order',
    });

    expect(r.status).toBe('created');
    expect(saveSpy).toHaveBeenCalledTimes(1);
  });

  it('auto ordre : supprime l’instantané de la même heure puis crée un point à jour (ex. suppression ordre → valeur 0)', async () => {
    const { createPortfolioSnapshot } = await import('@/features/market/portfolio/createPortfolioSnapshot');
    const { portfolioStorage } = await import('@/features/market/portfolio/portfolioStorage');

    const nowIso = new Date().toISOString();
    vi.spyOn(portfolioStorage, 'listSnapshots').mockResolvedValue([
      snap({
        id: 'same-hour-id',
        capturedAt: nowIso,
        totalMarketValue: 12_000,
      }),
    ]);
    vi.spyOn(portfolioStorage, 'listAccounts').mockResolvedValue([]);
    vi.spyOn(portfolioStorage, 'listOrders').mockResolvedValue([]);
    const delSpy = vi.spyOn(portfolioStorage, 'deleteSnapshot').mockResolvedValue();
    const saveSpy = vi.spyOn(portfolioStorage, 'saveSnapshot').mockResolvedValue();

    const r = await createPortfolioSnapshot({
      organizationId: 'org',
      settings: null,
      mode: 'auto',
      autoKind: 'order',
    });

    expect(r.status).toBe('created');
    expect(delSpy).toHaveBeenCalledWith('org', 'same-hour-id');
    expect(saveSpy).toHaveBeenCalledTimes(1);
    const payload = saveSpy.mock.calls[0]?.[0];
    expect(payload?.totalMarketValue).toBe(0);
  });
});
