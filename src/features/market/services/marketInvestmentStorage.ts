import { getLocalDB } from '@/lib/offline/db';
import type { PendingOperation } from '@/lib/offline/types';
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
import { defaultInvestmentStrategyConfig } from '@/features/market/services/marketInvestmentStrategy';
import {
  resolveCautionCashRatioThreshold,
  resolveMinCashReservePercent,
  resolveReinforceCooldownDays,
  resolveSuggestionReopenDrawdownDelta,
  resolveSuggestionSuppressDays,
} from '@/features/market/services/marketGuardrails';
import { normalizeMarketStorageSymbol } from '@/features/market/marketSymbolAliases';

export const DEFAULT_MARKET_INVESTMENT_SETTINGS_ID = 'default';
const SETTINGS_ID = DEFAULT_MARKET_INVESTMENT_SETTINGS_ID;
const MARKET_HISTORY_STORAGE_PREFIX = 'smartimmo.market.history';

function nowIso(): string {
  return new Date().toISOString();
}

type MarketPendingEntity = 'marketInvestmentSettings' | 'marketInvestmentActionLog';
type MarketPendingOperationType = 'create' | 'update' | 'delete';

/** Normalise un enregistrement profil marché (sans écriture DB) — utilisé par liste multi-profils / cockpit Patrimoine. */
export function normalizeInvestmentSettingsRecord(existing: InvestmentSettings): InvestmentSettings {
  const monthlyDca =
    typeof existing.monthlyDcaAmount === 'number' && Number.isFinite(existing.monthlyDcaAmount)
      ? existing.monthlyDcaAmount
      : 0;
  const rawIs = existing.investmentStrategy as InvestmentSettings['investmentStrategy'] | undefined;
  const hasLevels = Boolean(rawIs?.reinforceLevels?.length);
  const investmentStrategy: InvestmentSettings['investmentStrategy'] = hasLevels
    ? {
        monthlyDca: Number.isFinite(rawIs!.monthlyDca) && rawIs!.monthlyDca >= 0 ? rawIs!.monthlyDca : monthlyDca,
        reinforceLevels: rawIs!.reinforceLevels,
      }
    : defaultInvestmentStrategyConfig(monthlyDca);
  investmentStrategy.monthlyDca = monthlyDca;
  const symNorm = normalizeMarketStorageSymbol(existing.referenceSymbol);
  const normalized = {
    ...existing,
    referenceSymbol: symNorm,
    monthlyInvestmentDay:
      typeof existing.monthlyInvestmentDay === 'number' &&
      Number.isFinite(existing.monthlyInvestmentDay) &&
      existing.monthlyInvestmentDay >= 1 &&
      existing.monthlyInvestmentDay <= 31
        ? Math.trunc(existing.monthlyInvestmentDay)
        : 5,
    strategy: existing.strategy ?? 'DCA_PLUS_REINFORCE',
    reinforce10Threshold: typeof existing.reinforce10Threshold === 'number' ? existing.reinforce10Threshold : -10,
    reinforce20Threshold: typeof existing.reinforce20Threshold === 'number' ? existing.reinforce20Threshold : -20,
    cashReferenceAmount:
      typeof existing.cashReferenceAmount === 'number' ? existing.cashReferenceAmount : existing.availableCash ?? 0,
    investmentStrategy,
  } as InvestmentSettings;
  const guards = {
    minCashReservePercent: resolveMinCashReservePercent(normalized),
    cautionCashRatioThreshold: resolveCautionCashRatioThreshold(normalized),
    reinforceCooldownDays: resolveReinforceCooldownDays(normalized),
    suggestionSuppressDays: resolveSuggestionSuppressDays(normalized),
    suggestionReopenDrawdownDelta: resolveSuggestionReopenDrawdownDelta(normalized),
  };
  return {
    ...normalized,
    ...guards,
    investmentStrategy: { ...investmentStrategy, ...guards },
  } as InvestmentSettings;
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
  monthlyInvestmentDay: 5,
  reinforce10Threshold: -10,
  reinforce20Threshold: -20,
  reinforce10Amount: 1000,
  reinforce20Amount: 2000,
  strategy: 'DCA_PLUS_REINFORCE',
  cashReferenceAmount: 15000,
  currency: 'EUR',
  updatedAt: nowIso(),
  peaSocialContributionsOnGainsRate: 0.172,
  investmentStrategy: defaultInvestmentStrategyConfig(1000),
});

export class MarketInvestmentStorage {
  private async enqueueMarketPendingOperation(input: {
    entity: MarketPendingEntity;
    entityId: string;
    operation: MarketPendingOperationType;
    payload: Record<string, unknown>;
    organizationId: string;
  }): Promise<void> {
    const db = await getLocalDB();
    const byStatus = async (status: 'pending' | 'syncing') =>
      ((await db.pendingOperations.where('[entity+status]').equals([input.entity, status]).toArray()) as PendingOperation[]).filter(
        (op) => op.entityId === input.entityId
      );

    const existing = [...(await byStatus('pending')), ...(await byStatus('syncing'))];
    if (existing.length > 0) {
      await Promise.all(existing.map((op) => db.pendingOperations.delete(op.id)));
    }

    // Si on supprime une action jamais synchronisée (create en attente), annuler simplement l'intention.
    if (input.operation === 'delete' && existing.some((op) => op.operation === 'create')) {
      this.notifyPendingOpsChanged(input.organizationId);
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

    this.notifyPendingOpsChanged(input.organizationId);
    await this.triggerGlobalSyncIfOnline(input.organizationId);
  }

  private notifyPendingOpsChanged(organizationId: string): void {
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
      // Best-effort: la file sera traitée par AppShell/useSyncStatus.
    }
  }

  private historyStorageKey(organizationId: string, symbol: string, athPeriod: AthPeriod): string {
    return `${MARKET_HISTORY_STORAGE_PREFIX}:${organizationId}:${normalizeMarketStorageSymbol(symbol)}:${athPeriod}`;
  }

  /** Ancienne clé localStorage (symbole non normalisé). */
  private legacyHistoryStorageKey(organizationId: string, symbol: string, athPeriod: AthPeriod): string {
    return `${MARKET_HISTORY_STORAGE_PREFIX}:${organizationId}:${(symbol || '').trim()}:${athPeriod}`;
  }

  async getInvestmentProfileById(organizationId: string, profileId: string): Promise<InvestmentSettings | null> {
    const db = await getLocalDB();
    const row = await db.InvestmentSettings.get([organizationId, profileId]);
    return row ? normalizeInvestmentSettingsRecord(row) : null;
  }

  async getSettings(organizationId: string): Promise<InvestmentSettings> {
    const db = await getLocalDB();
    const existing = await db.InvestmentSettings.get([organizationId, SETTINGS_ID]);
    if (existing) {
      const merged = normalizeInvestmentSettingsRecord(existing);
      await db.InvestmentSettings.put(merged);
      return merged;
    }
    const defaults = defaultInvestmentSettings(organizationId);
    await db.InvestmentSettings.put(defaults);
    return defaults;
  }

  /** Mise à jour ciblée d’un profil marché depuis le cockpit Patrimoine (cash / DCA / jour). */
  async updateInvestmentProfileFromPatrimoine(
    organizationId: string,
    profileId: string,
    patch: {
      availableCash?: number;
      monthlyDcaAmount?: number;
      monthlyInvestmentDay?: number;
    }
  ): Promise<'ok' | 'not_found'> {
    const db = await getLocalDB();
    const row = await db.InvestmentSettings.get([organizationId, profileId]);
    if (!row) return 'not_found';
    const base = normalizeInvestmentSettingsRecord(row);
    const next: InvestmentSettings = { ...base };
    if (patch.availableCash !== undefined) {
      const v = Math.round(Math.max(0, Number(patch.availableCash)) * 100) / 100;
      next.availableCash = Number.isFinite(v) ? v : base.availableCash;
    }
    if (patch.monthlyDcaAmount !== undefined) {
      const v = Math.round(Math.max(0, Number(patch.monthlyDcaAmount)) * 100) / 100;
      next.monthlyDcaAmount = Number.isFinite(v) ? v : base.monthlyDcaAmount;
    }
    if (patch.monthlyInvestmentDay !== undefined) {
      const raw = Math.trunc(Number(patch.monthlyInvestmentDay));
      if (Number.isFinite(raw) && raw >= 1 && raw <= 31) {
        next.monthlyInvestmentDay = raw;
      }
    }
    await this.saveSettings(next);
    return 'ok';
  }

  async saveSettings(settings: InvestmentSettings): Promise<void> {
    const db = await getLocalDB();
    const existing = await db.InvestmentSettings.get([settings.organizationId, settings.id]);
    const baseStrategy = settings.investmentStrategy ?? defaultInvestmentStrategyConfig(settings.monthlyDcaAmount);
    const draft: InvestmentSettings = {
      ...settings,
      investmentStrategy: { ...baseStrategy, monthlyDca: settings.monthlyDcaAmount },
    };
    const guards = {
      minCashReservePercent: resolveMinCashReservePercent(draft),
      cautionCashRatioThreshold: resolveCautionCashRatioThreshold(draft),
      reinforceCooldownDays: resolveReinforceCooldownDays(draft),
      suggestionSuppressDays: resolveSuggestionSuppressDays(draft),
      suggestionReopenDrawdownDelta: resolveSuggestionReopenDrawdownDelta(draft),
    };
    const normalized = {
      ...settings,
      ...guards,
      referenceSymbol: normalizeMarketStorageSymbol(settings.referenceSymbol),
      monthlyInvestmentDay:
        typeof settings.monthlyInvestmentDay === 'number' &&
        Number.isFinite(settings.monthlyInvestmentDay) &&
        settings.monthlyInvestmentDay >= 1 &&
        settings.monthlyInvestmentDay <= 31
          ? Math.trunc(settings.monthlyInvestmentDay)
          : 5,
      investmentStrategy: { ...baseStrategy, monthlyDca: settings.monthlyDcaAmount, ...guards },
      updatedAt: nowIso(),
    };
    await db.InvestmentSettings.put(normalized);
    await this.enqueueMarketPendingOperation({
      entity: 'marketInvestmentSettings',
      entityId: normalized.id,
      operation: existing ? 'update' : 'create',
      payload: normalized as unknown as Record<string, unknown>,
      organizationId: normalized.organizationId,
    });
  }

  /** Tous les profils marché normalisés (tri updatedAt desc) — sélection cockpit Patrimoine. */
  async listAllInvestmentProfilesNormalized(organizationId: string): Promise<InvestmentSettings[]> {
    const db = await getLocalDB();
    const rows = await db.InvestmentSettings.where('organizationId').equals(organizationId).toArray();
    const list = rows.map((r) => normalizeInvestmentSettingsRecord(r));
    list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return list;
  }

  async getSnapshot(organizationId: string, symbol: string, athPeriod: AthPeriod): Promise<MarketSnapshot | null> {
    const db = await getLocalDB();
    const trimmed = (symbol || '').trim();
    const norm = normalizeMarketStorageSymbol(symbol);

    const byExactPeriod = (await db.MarketSnapshot.where('[organizationId+symbol+athPeriod]')
      .equals([organizationId, trimmed, athPeriod])
      .first()) as MarketSnapshot | undefined;
    if (byExactPeriod) {
      return byExactPeriod;
    }

    if (norm !== trimmed) {
      const byNorm = (await db.MarketSnapshot.where('[organizationId+symbol+athPeriod]')
        .equals([organizationId, norm, athPeriod])
        .first()) as MarketSnapshot | undefined;
      if (byNorm) {
        return byNorm;
      }
    }

    const allOrg = (await db.MarketSnapshot.where('organizationId').equals(organizationId).toArray()) as MarketSnapshot[];
    const byCanon = allOrg.find(
      (row) => row.athPeriod === athPeriod && normalizeMarketStorageSymbol(row.symbol) === norm
    );
    if (byCanon) {
      return byCanon;
    }

    const legacyRow = (await db.MarketSnapshot.get([organizationId, trimmed])) as MarketSnapshot | undefined;
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

  async listAllSnapshots(organizationId: string): Promise<MarketSnapshot[]> {
    const db = await getLocalDB();
    return (await db.MarketSnapshot.where('organizationId').equals(organizationId).toArray()) as MarketSnapshot[];
  }

  getPriceHistory(organizationId: string, symbol: string, athPeriod: AthPeriod): MarketHistoryPoint[] {
    if (typeof window === 'undefined') return [];
    try {
      const key = this.historyStorageKey(organizationId, symbol, athPeriod);
      let raw = window.localStorage.getItem(key);
      if (!raw) {
        raw = window.localStorage.getItem(this.legacyHistoryStorageKey(organizationId, symbol, athPeriod));
      }
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
      const legacyKey = this.legacyHistoryStorageKey(organizationId, symbol, athPeriod);
      if (!history.length) {
        window.localStorage.removeItem(key);
        window.localStorage.removeItem(legacyKey);
        return;
      }
      window.localStorage.removeItem(legacyKey);
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

  async getActionLogById(organizationId: string, logId: string): Promise<InvestmentActionLog | null> {
    const db = await getLocalDB();
    const row = (await db.InvestmentActionLog.get(logId)) as InvestmentActionLog | undefined;
    if (!row || row.organizationId !== organizationId) return null;
    return row;
  }

  /**
   * Ajuste le montant validé et la note / raison ; recalcule le cash disponible (delta ancien → nouveau).
   * Ne modifie pas le type, symbole, drawdown, prix, date initiale ni le statut marché stockés sur la ligne.
   */
  async updateValidatedDecision(
    organizationId: string,
    logId: string,
    patch: { validatedAmount: number; reason: string; note?: string | null }
  ): Promise<'ok' | 'not_found' | 'invalid_status' | 'invalid_amount'> {
    const log = await this.getActionLogById(organizationId, logId);
    if (!log) return 'not_found';
    if (log.status !== 'validated') return 'invalid_status';

    const oldAmount = log.validatedAmount;
    const newAmount = Math.round(Math.max(0, Number(patch.validatedAmount)) * 100) / 100;
    if (!Number.isFinite(newAmount) || newAmount < 0) return 'invalid_amount';

    const settings = await this.getSettings(organizationId);
    const maxAllowed = settings.availableCash + oldAmount;
    if (newAmount > maxAllowed + 1e-6) return 'invalid_amount';

    const newAvailable = Math.round((settings.availableCash + oldAmount - newAmount) * 100) / 100;
    const newCashAfter = Math.round((log.cashBefore - newAmount) * 100) / 100;

    const updated: InvestmentActionLog = {
      ...log,
      validatedAmount: newAmount,
      cashAfter: newCashAfter,
      reason: patch.reason.trim().slice(0, 220) || log.reason,
      note: patch.note !== undefined ? (patch.note === '' ? null : patch.note) : log.note,
      updatedAt: nowIso(),
    };

    const db = await getLocalDB();
    await db.InvestmentActionLog.put(updated);
    await this.enqueueMarketPendingOperation({
      entity: 'marketInvestmentActionLog',
      entityId: updated.id,
      operation: 'update',
      payload: updated as unknown as Record<string, unknown>,
      organizationId,
    });
    await this.saveSettings({
      ...settings,
      availableCash: Math.max(0, newAvailable),
      updatedAt: nowIso(),
    });
    return 'ok';
  }

  /** Supprime une décision validée et restitue le montant au cash disponible. */
  async deleteValidatedDecision(organizationId: string, logId: string): Promise<'ok' | 'not_found' | 'invalid_status' | 'failed'> {
    const log = await this.getActionLogById(organizationId, logId);
    if (!log) return 'not_found';
    if (log.status !== 'validated') return 'invalid_status';

    const settings = await this.getSettings(organizationId);
    const previousCash = settings.availableCash;
    const restored = Math.round((previousCash + Math.max(0, log.validatedAmount)) * 100) / 100;

    try {
      await this.saveSettings({
        ...settings,
        availableCash: restored,
        updatedAt: nowIso(),
      });
      const db = await getLocalDB();
      await db.InvestmentActionLog.delete(logId);
      await this.enqueueMarketPendingOperation({
        entity: 'marketInvestmentActionLog',
        entityId: logId,
        operation: 'delete',
        payload: {},
        organizationId,
      });
    } catch {
      try {
        await this.saveSettings({
          ...settings,
          availableCash: previousCash,
          updatedAt: nowIso(),
        });
      } catch {
        // no-op
      }
      return 'failed';
    }
    return 'ok';
  }

  async addActionLog(payload: InvestmentActionLog): Promise<void> {
    const db = await getLocalDB();
    const existing = await db.InvestmentActionLog.get(payload.id);
    await db.InvestmentActionLog.put(payload);
    await this.enqueueMarketPendingOperation({
      entity: 'marketInvestmentActionLog',
      entityId: payload.id,
      operation: existing ? 'update' : 'create',
      payload: payload as unknown as Record<string, unknown>,
      organizationId: payload.organizationId,
    });
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
      message:
        input.level === 'FORTE_OPPORTUNITE'
          ? 'Forte opportunité : le marché a reculé d’au moins 20 % par rapport au plus haut de référence.'
          : 'Opportunité : le marché a reculé d’au moins 10 % — moment intéressant pour revoir votre plan d’investissement.',
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
