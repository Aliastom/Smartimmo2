import type { InvestmentSettings } from '@/features/market/types';

import { portfolioStorage } from '@/features/market/portfolio/portfolioStorage';

import { buildPortfolioSnapshotMetrics } from '@/features/market/portfolio/portfolioSnapshotMetrics';

import { fetchPortfolioPriceLookup } from '@/features/market/portfolio/portfolioPriceLookup';

import type { PortfolioSnapshot } from '@/features/market/portfolio/portfolioTypes';

import {
  PORTFOLIO_SNAPSHOT_STALE_MS,
  PORTFOLIO_SNAPSHOT_VOLATILITY_THRESHOLD,
  filterSnapshotsInSameLocalHour,
  hasPortfolioSnapshotInSameLocalHour,
  hasRecentPortfolioSnapshot,
  isPortfolioSnapshotOnVolatilityEnabled,
  shouldTriggerVolatilitySnapshot,
} from '@/features/market/portfolio/portfolioSnapshotGuards';

export type AutoSnapshotKind = 'order' | 'cash' | 'daily' | 'volatility';

export type CreatePortfolioSnapshotResult =
  | { status: 'created'; snapshot: PortfolioSnapshot }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; message: string };

export interface CreatePortfolioSnapshotInput {
  organizationId: string;

  settings: InvestmentSettings | null;

  /** Manuel : pas de garde-fous ; utilisé par « Capturer un instantané ». */

  mode: 'manual' | 'auto';

  autoKind?: AutoSnapshotKind;

  /** Liste optionnelle pour éviter une lecture IDB (hook déjà chargé). */

  cachedSnapshots?: PortfolioSnapshot[];
}

/**

 * Construit les agrégats via le moteur existant (`buildPortfolioSnapshotMetrics`) et persiste un `PortfolioSnapshot` local.

 * Les instantanés automatiques appliquent les garde-fous (12 h, même heure, volatilité optionnelle).

 * Mutations **order** / **cash** : remplace les instantanés de la même heure locale pour éviter un graphe figé sur l’ancienne valorisation.

 */

export async function createPortfolioSnapshot(
  input: CreatePortfolioSnapshotInput,
): Promise<CreatePortfolioSnapshotResult> {
  const { organizationId, settings, mode, autoKind, cachedSnapshots } = input;

  const nowMs = Date.now();

  try {
    let snapshots = cachedSnapshots;

    if (!snapshots) {
      snapshots = await portfolioStorage.listSnapshots(organizationId);
    }

    if (mode === 'auto' && autoKind === 'daily') {
      if (hasPortfolioSnapshotInSameLocalHour(snapshots, nowMs)) {
        return { status: 'skipped', reason: 'same_local_hour' };
      }

      if (hasRecentPortfolioSnapshot(snapshots, nowMs, PORTFOLIO_SNAPSHOT_STALE_MS)) {
        return { status: 'skipped', reason: 'snapshot_within_12h' };
      }
    }

    const accounts = await portfolioStorage.listAccounts(organizationId);

    const orders = await portfolioStorage.listOrders(organizationId);

    const prices = await fetchPortfolioPriceLookup(organizationId, orders, settings);

    const metrics = buildPortfolioSnapshotMetrics({
      accounts,

      orders,

      prices,

      nowMs,

      settings,
    });

    if (mode === 'auto' && autoKind === 'volatility') {
      if (!isPortfolioSnapshotOnVolatilityEnabled()) {
        return { status: 'skipped', reason: 'volatility_flag_off' };
      }

      if (hasPortfolioSnapshotInSameLocalHour(snapshots, nowMs)) {
        return { status: 'skipped', reason: 'same_local_hour' };
      }

      if (
        !shouldTriggerVolatilitySnapshot(
          snapshots,
          metrics.totalMarketValue,
          PORTFOLIO_SNAPSHOT_VOLATILITY_THRESHOLD,
        )
      ) {
        return { status: 'skipped', reason: 'below_volatility_threshold' };
      }
    }

    if (mode === 'auto' && (autoKind === 'order' || autoKind === 'cash')) {
      const toRemove = filterSnapshotsInSameLocalHour(snapshots, nowMs);
      for (const s of toRemove) {
        await portfolioStorage.deleteSnapshot(organizationId, s.id);
      }
    }

    const nowIso = new Date(nowMs).toISOString();

    const row: PortfolioSnapshot = {
      id: crypto.randomUUID(),

      organizationId,

      capturedAt: nowIso,

      createdAt: nowIso,

      ...metrics,
    };

    await portfolioStorage.saveSnapshot(row);

    return { status: 'created', snapshot: row };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);

    return { status: 'error', message };
  }
}
