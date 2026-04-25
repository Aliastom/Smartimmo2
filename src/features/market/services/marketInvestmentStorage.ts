import { getLocalDB } from '@/lib/offline/db';
import type { MarketHistoryPoint } from '@/features/market/services/marketDataService';
import type {
  AthPeriod,
  InvestmentActionLog,
  InvestmentActionStatus,
  InvestmentSettings,
  MarketAlert,
  MarketSnapshot,
  MarketOpportunityStatus,
} from '@/features/market/types';

const SETTINGS_ID = 'default';
const MARKET_HISTORY_STORAGE_PREFIX = 'smartimmo.market.history';

function nowIso(): string {
  return new Date().toISOString();
}

export const defaultInvestmentSettings = (organizationId: string): InvestmentSettings => ({
  id: SETTINGS_ID,
  organizationId,
  referenceSymbol: 'CW8.PA',
  referenceLabel: 'Amundi MSCI World UCITS ETF',
  envelope: 'PEA',
  athPeriod: 'MAX',
  availableCash: 15000,
  monthlyDcaAmount: 1000,
  reinforce10Threshold: -10,
  reinforce20Threshold: -20,
  reinforce10Amount: 1000,
  reinforce20Amount: 2000,
  strategy: 'DCA_PLUS_REINFORCE',
  cashReferenceAmount: 15000,
  currency: 'EUR',
  updatedAt: nowIso(),
});

export class MarketInvestmentStorage {
  private historyStorageKey(organizationId: string, symbol: string, athPeriod: AthPeriod): string {
    return `${MARKET_HISTORY_STORAGE_PREFIX}:${organizationId}:${symbol}:${athPeriod}`;
  }

  async getSettings(organizationId: string): Promise<InvestmentSettings> {
    const db = await getLocalDB();
    const existing = await db.InvestmentSettings.get([organizationId, SETTINGS_ID]);
    if (existing) {
      const normalized = {
        ...existing,
        strategy: existing.strategy ?? 'DCA_PLUS_REINFORCE',
        reinforce10Threshold:
          typeof existing.reinforce10Threshold === 'number' ? existing.reinforce10Threshold : -10,
        reinforce20Threshold:
          typeof existing.reinforce20Threshold === 'number' ? existing.reinforce20Threshold : -20,
        cashReferenceAmount: typeof existing.cashReferenceAmount === 'number' ? existing.cashReferenceAmount : existing.availableCash ?? 0,
      } as InvestmentSettings;
      await db.InvestmentSettings.put(normalized);
      return normalized;
    }
    const defaults = defaultInvestmentSettings(organizationId);
    await db.InvestmentSettings.put(defaults);
    return defaults;
  }

  async saveSettings(settings: InvestmentSettings): Promise<void> {
    const db = await getLocalDB();
    await db.InvestmentSettings.put({ ...settings, updatedAt: nowIso() });
  }

  async getSnapshot(organizationId: string, symbol: string, athPeriod: AthPeriod): Promise<MarketSnapshot | null> {
    const db = await getLocalDB();
    const byExactPeriod = (await db.MarketSnapshot.where('[organizationId+symbol+athPeriod]')
      .equals([organizationId, symbol, athPeriod])
      .first()) as MarketSnapshot | undefined;
    if (byExactPeriod) {
      return byExactPeriod;
    }

    const legacyRow = (await db.MarketSnapshot.get([organizationId, symbol])) as MarketSnapshot | undefined;
    if (!legacyRow) {
      return null;
    }

    // Compat legacy: anciennes lignes sans athPeriod (ou obsolètes) sont normalisées à la lecture.
    if (legacyRow.athPeriod !== athPeriod) {
      return null;
    }
    return legacyRow;
  }

  async saveSnapshot(snapshot: MarketSnapshot): Promise<void> {
    const db = await getLocalDB();
    await db.MarketSnapshot.put(snapshot);
  }

  async listSnapshots(organizationId: string, symbols: string[], athPeriod: AthPeriod): Promise<MarketSnapshot[]> {
    if (symbols.length === 0) return [];
    const db = await getLocalDB();
    const rows = (await db.MarketSnapshot.where('organizationId').equals(organizationId).toArray()) as MarketSnapshot[];
    const symbolSet = new Set(symbols.map((symbol) => symbol.trim()).filter(Boolean));
    return rows.filter((row) => symbolSet.has(row.symbol) && row.athPeriod === athPeriod);
  }

  getPriceHistory(organizationId: string, symbol: string, athPeriod: AthPeriod): MarketHistoryPoint[] {
    if (typeof window === 'undefined') return [];
    try {
      const key = this.historyStorageKey(organizationId, symbol, athPeriod);
      const raw = window.localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Array<{ date?: unknown; close?: unknown; high?: unknown }>;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((point) => ({
          date: typeof point.date === 'string' ? point.date : '',
          close: Number(point.close),
          high: point.high == null ? null : Number(point.high),
        }))
        .filter((point) => point.date && Number.isFinite(point.close) && point.close > 0);
    } catch {
      return [];
    }
  }

  savePriceHistory(
    organizationId: string,
    symbol: string,
    athPeriod: AthPeriod,
    history: MarketHistoryPoint[]
  ): void {
    if (typeof window === 'undefined') return;
    try {
      const key = this.historyStorageKey(organizationId, symbol, athPeriod);
      if (!history.length) {
        window.localStorage.removeItem(key);
        return;
      }
      window.localStorage.setItem(key, JSON.stringify(history));
    } catch {
      // no-op: localStorage quota/private mode
    }
  }

  async listActionLogs(organizationId: string, limit = 20): Promise<InvestmentActionLog[]> {
    const db = await getLocalDB();
    const rows = await db.InvestmentActionLog.where('organizationId').equals(organizationId).toArray();
    return (rows as InvestmentActionLog[])
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  }

  async addActionLog(payload: InvestmentActionLog): Promise<void> {
    const db = await getLocalDB();
    await db.InvestmentActionLog.put(payload);
  }

  async getLatestThresholdDecision(
    organizationId: string,
    thresholdKey: string
  ): Promise<InvestmentActionLog | null> {
    const db = await getLocalDB();
    const rows = (await db.InvestmentActionLog.where('organizationId').equals(organizationId).toArray()) as InvestmentActionLog[];
    const matching = rows
      .filter((row) => row.thresholdKey === thresholdKey && (row.status === 'validated' || row.status === 'ignored'))
      .sort((a, b) => b.date.localeCompare(a.date));
    return matching[0] ?? null;
  }

  async addAlertIfMissing(input: {
    organizationId: string;
    symbol: string;
    level: Exclude<MarketOpportunityStatus, 'NORMAL'>;
    drawdownPercent: number;
  }): Promise<void> {
    const db = await getLocalDB();
    const key = `${input.symbol}:${input.level}`;
    const existing = (await db.MarketAlert.where('organizationId').equals(input.organizationId).toArray()) as MarketAlert[];
    if (existing.some((item) => item.id === `${input.organizationId}:${key}`)) {
      return;
    }
    await db.MarketAlert.put({
      id: `${input.organizationId}:${key}`,
      organizationId: input.organizationId,
      symbol: input.symbol,
      level: input.level,
      message: input.level === 'FORTE_OPPORTUNITE' ? 'Forte opportunité détectée (<= -20%).' : 'Opportunité détectée (<= -10%).',
      drawdownPercent: input.drawdownPercent,
      createdAt: nowIso(),
      readAt: null,
    } satisfies MarketAlert);
  }

  buildActionLog(input: {
    organizationId: string;
    type: InvestmentActionLog['type'];
    recommendedAmount: number;
    validatedAmount: number;
    cashBefore: number;
    cashAfter: number;
    status: InvestmentActionStatus;
    reason: string;
    drawdownAtDecision: number;
    athPriceAtDecision: number;
    currentPriceAtDecision: number;
    symbolAtDecision: string;
    marketStatusAtDecision: InvestmentActionLog['marketStatusAtDecision'];
    athPeriodAtDecision: InvestmentActionLog['athPeriodAtDecision'];
    thresholdKey?: string | null;
    marketLevelKey?: string | null;
    drawdownPercentAtAction?: number; // compat legacy
    note?: string;
  }): InvestmentActionLog {
    return {
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      date: nowIso(),
      type: input.type,
      recommendedAmount: input.recommendedAmount,
      validatedAmount: input.validatedAmount,
      cashBefore: input.cashBefore,
      cashAfter: input.cashAfter,
      reason: input.reason,
      drawdownAtDecision: input.drawdownAtDecision,
      athPriceAtDecision: input.athPriceAtDecision,
      currentPriceAtDecision: input.currentPriceAtDecision,
      symbolAtDecision: input.symbolAtDecision,
      marketStatusAtDecision: input.marketStatusAtDecision,
      athPeriodAtDecision: input.athPeriodAtDecision,
      status: input.status,
      thresholdKey: input.thresholdKey ?? null,
      marketLevelKey: input.marketLevelKey ?? null,
      drawdownPercentAtAction: input.drawdownPercentAtAction ?? null,
      note: input.note ?? null,
    };
  }
}

export const marketInvestmentStorage = new MarketInvestmentStorage();
