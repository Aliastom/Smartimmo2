import { getLocalDB } from '@/lib/offline/db';
import type { PendingOperation } from '@/lib/offline/types';
import type { LocalPortfolioAccount, LocalPortfolioOrder, LocalPortfolioSnapshot } from '@/lib/offline/db';
import { normalizeMarketStorageSymbol } from '@/features/market/marketSymbolAliases';
import type {
  PortfolioAccount,
  PortfolioOrder,
  PortfolioOrderType,
  PortfolioSnapshot,
} from '@/features/market/portfolio/portfolioTypes';

function nowIso(): string {
  return new Date().toISOString();
}

type PortfolioPendingEntity = 'portfolioAccount' | 'portfolioOrder' | 'portfolioSnapshot';

export function toLocalAccount(row: PortfolioAccount): LocalPortfolioAccount {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    kind: row.kind,
    currency: row.currency,
    inflationAnnualRate: row.inflationAnnualRate ?? null,
    fiscalProfileId: row.fiscalProfileId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toLocalSnapshot(row: PortfolioSnapshot): LocalPortfolioSnapshot {
  return {
    id: row.id,
    organizationId: row.organizationId,
    capturedAt: row.capturedAt,
    totalMarketValue: row.totalMarketValue,
    totalRemainingCostBasis: row.totalRemainingCostBasis,
    totalUnrealizedPnL: row.totalUnrealizedPnL,
    totalRealizedPnL: row.totalRealizedPnL,
    totalDividendsNet: row.totalDividendsNet,
    grossPerformanceEuro: row.grossPerformanceEuro,
    netPerformanceAfterTaxEuro: row.netPerformanceAfterTaxEuro,
    surplusInflationEuro: row.surplusInflationEuro,
    valuationIncomplete: row.valuationIncomplete,
    createdAt: row.createdAt,
  };
}

export function toLocalOrder(row: PortfolioOrder): LocalPortfolioOrder {
  return {
    id: row.id,
    organizationId: row.organizationId,
    accountId: row.accountId,
    assetSymbol: normalizeMarketStorageSymbol(row.assetSymbol),
    assetIsin: row.assetIsin ?? null,
    type: row.type,
    date: row.date,
    quantity: row.quantity,
    unitPrice: row.unitPrice ?? null,
    grossAmount: row.grossAmount ?? null,
    fees: row.fees ?? 0,
    taxes: row.taxes ?? 0,
    currency: row.currency,
    note: row.note ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PortfolioStorage {
  private async enqueue(input: {
    entity: PortfolioPendingEntity;
    entityId: string;
    operation: 'create' | 'update' | 'delete';
    payload: Record<string, unknown>;
    organizationId: string;
  }): Promise<void> {
    const db = await getLocalDB();
    if (!db) return;
    const byStatus = async (status: 'pending' | 'syncing') =>
      ((await db.pendingOperations.where('[entity+status]').equals([input.entity, status]).toArray()) as PendingOperation[]).filter(
        (op) => op.entityId === input.entityId
      );
    const existing = [...(await byStatus('pending')), ...(await byStatus('syncing'))];
    if (existing.length > 0) {
      await Promise.all(existing.map((op) => db.pendingOperations.delete(op.id)));
    }
    if (input.operation === 'delete' && existing.some((op) => op.operation === 'create')) {
      this.notify(input.organizationId);
      return;
    }
    const now = nowIso();
    await db.pendingOperations.add({
      id: crypto.randomUUID(),
      entity: input.entity,
      entityId: input.entityId,
      operation: input.operation,
      payload: input.payload,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      retryCount: 0,
      organizationId: input.organizationId,
    } satisfies PendingOperation);
    this.notify(input.organizationId);
    await this.triggerGlobalSyncIfOnline(input.organizationId);
  }

  private notify(organizationId: string): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('pendingOp:created', { detail: { organizationId } }));
    window.dispatchEvent(new CustomEvent('sync:refresh'));
  }

  private async triggerGlobalSyncIfOnline(organizationId: string): Promise<void> {
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.onLine) return;
    try {
      const { getGlobalSyncService } = await import('@/lib/offline/syncGlobal');
      void getGlobalSyncService().syncAllPendingToRemote(organizationId);
    } catch {
      // best-effort
    }
  }

  async listAccounts(organizationId: string): Promise<PortfolioAccount[]> {
    const db = await getLocalDB();
    if (!db) return [];
    const rows = await db.PortfolioAccount.where('organizationId').equals(organizationId).toArray();
    return rows
      .map((r) => this.mapAccount(r))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getAccount(organizationId: string, id: string): Promise<PortfolioAccount | null> {
    const db = await getLocalDB();
    if (!db) return null;
    const row = await db.PortfolioAccount.get([organizationId, id]);
    return row ? this.mapAccount(row) : null;
  }

  private mapAccount(r: LocalPortfolioAccount): PortfolioAccount {
    return {
      id: r.id,
      organizationId: r.organizationId,
      name: r.name,
      kind: r.kind as PortfolioAccount['kind'],
      currency: r.currency,
      inflationAnnualRate: r.inflationAnnualRate ?? null,
      fiscalProfileId: r.fiscalProfileId ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async saveAccount(input: PortfolioAccount): Promise<void> {
    const db = await getLocalDB();
    if (!db) throw new Error('IndexedDB indisponible');
    const local = toLocalAccount(input);
    const existing = await db.PortfolioAccount.get([input.organizationId, input.id]);
    await db.PortfolioAccount.put(local);
    await this.enqueue({
      entity: 'portfolioAccount',
      entityId: input.id,
      operation: existing ? 'update' : 'create',
      payload: local as unknown as Record<string, unknown>,
      organizationId: input.organizationId,
    });
  }

  async deleteAccount(organizationId: string, id: string): Promise<void> {
    const db = await getLocalDB();
    if (!db) throw new Error('IndexedDB indisponible');
    const orders = await db.PortfolioOrder.where('organizationId').equals(organizationId).toArray();
    const linked = orders.filter((o) => o.accountId === id);
    for (const o of linked) {
      await this.deleteOrder(organizationId, o.id);
    }
    await db.PortfolioAccount.delete([organizationId, id]);
    await this.enqueue({
      entity: 'portfolioAccount',
      entityId: id,
      operation: 'delete',
      payload: {},
      organizationId,
    });
  }

  async listOrders(organizationId: string): Promise<PortfolioOrder[]> {
    const db = await getLocalDB();
    if (!db) return [];
    const rows = await db.PortfolioOrder.where('organizationId').equals(organizationId).toArray();
    return rows
      .map((r) => this.mapOrder(r))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  private mapOrder(r: LocalPortfolioOrder): PortfolioOrder {
    return {
      id: r.id,
      organizationId: r.organizationId,
      accountId: r.accountId,
      assetSymbol: r.assetSymbol,
      assetIsin: r.assetIsin ?? null,
      type: r.type as PortfolioOrderType,
      date: r.date,
      quantity: r.quantity,
      unitPrice: r.unitPrice,
      grossAmount: r.grossAmount,
      fees: r.fees,
      taxes: r.taxes,
      currency: r.currency,
      note: r.note ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async saveOrder(input: PortfolioOrder): Promise<void> {
    const db = await getLocalDB();
    if (!db) throw new Error('IndexedDB indisponible');
    const local = toLocalOrder(input);
    const existing = await db.PortfolioOrder.get(input.id);
    await db.PortfolioOrder.put(local);
    await this.enqueue({
      entity: 'portfolioOrder',
      entityId: input.id,
      operation: existing ? 'update' : 'create',
      payload: local as unknown as Record<string, unknown>,
      organizationId: input.organizationId,
    });
    this.dispatchOrdersMutated(input.organizationId);
  }

  async deleteOrder(organizationId: string, id: string): Promise<void> {
    const db = await getLocalDB();
    if (!db) throw new Error('IndexedDB indisponible');
    const row = await db.PortfolioOrder.get(id);
    if (!row || row.organizationId !== organizationId) return;
    await db.PortfolioOrder.delete(id);
    await this.enqueue({
      entity: 'portfolioOrder',
      entityId: id,
      operation: 'delete',
      payload: {},
      organizationId,
    });
    this.dispatchOrdersMutated(organizationId);
  }

  private dispatchOrdersMutated(organizationId: string): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('portfolio:orders-mutated', { detail: { organizationId } }));
  }

  private mapSnapshot(r: LocalPortfolioSnapshot): PortfolioSnapshot {
    return {
      id: r.id,
      organizationId: r.organizationId,
      capturedAt: r.capturedAt,
      totalMarketValue: r.totalMarketValue,
      totalRemainingCostBasis: r.totalRemainingCostBasis,
      totalUnrealizedPnL: r.totalUnrealizedPnL,
      totalRealizedPnL: r.totalRealizedPnL,
      totalDividendsNet: r.totalDividendsNet,
      grossPerformanceEuro: r.grossPerformanceEuro,
      netPerformanceAfterTaxEuro: r.netPerformanceAfterTaxEuro,
      surplusInflationEuro: r.surplusInflationEuro,
      valuationIncomplete: r.valuationIncomplete,
      createdAt: r.createdAt,
    };
  }

  async listSnapshots(organizationId: string, limit = 500): Promise<PortfolioSnapshot[]> {
    const db = await getLocalDB();
    if (!db) return [];
    const rows = await db.PortfolioSnapshot.where('organizationId').equals(organizationId).toArray();
    return rows
      .map((r) => this.mapSnapshot(r))
      .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
      .slice(-limit);
  }

  async saveSnapshot(input: PortfolioSnapshot): Promise<void> {
    const db = await getLocalDB();
    if (!db) throw new Error('IndexedDB indisponible');
    const local = toLocalSnapshot(input);
    await db.PortfolioSnapshot.put(local);
    await this.enqueue({
      entity: 'portfolioSnapshot',
      entityId: input.id,
      operation: 'create',
      payload: local as unknown as Record<string, unknown>,
      organizationId: input.organizationId,
    });
    this.notify(input.organizationId);
  }

  /** Supprime un instantané local (+ file sync). Utilisé pour remplacer le point « même heure » après mutation portefeuille. */
  async deleteSnapshot(organizationId: string, snapshotId: string): Promise<void> {
    const db = await getLocalDB();
    if (!db) throw new Error('IndexedDB indisponible');
    const row = await db.PortfolioSnapshot.get([organizationId, snapshotId]);
    if (!row) return;
    await db.PortfolioSnapshot.delete([organizationId, snapshotId]);
    await this.enqueue({
      entity: 'portfolioSnapshot',
      entityId: snapshotId,
      operation: 'delete',
      payload: {},
      organizationId,
    });
    this.notify(organizationId);
  }
}

export const portfolioStorage = new PortfolioStorage();
