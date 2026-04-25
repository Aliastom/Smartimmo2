import { computeDrawdownPercent, resolveMarketStatus } from '@/features/market/services/marketDecisionService';
import { ETF_REFERENCE_ALIASES } from '@/features/market/marketSymbolAliases';
import type { AthPeriod, InvestmentSettings, MarketOpportunityStatus, MarketSnapshot } from '@/features/market/types';

export type MarketProviderId = 'alpha-vantage' | 'yahoo-api';
export type MarketProviderErrorCode =
  | 'API_KEY_MISSING'
  | 'RATE_LIMIT_LOCAL'
  | 'RATE_LIMIT_REMOTE'
  | 'SYMBOL_NOT_FOUND'
  | 'INCOMPLETE_DATA'
  | 'NETWORK_ERROR'
  | 'PROVIDER_DISABLED'
  | 'UNKNOWN_PROVIDER_ERROR';

export class MarketProviderError extends Error {
  readonly code: MarketProviderErrorCode;
  readonly provider: MarketProviderId;
  readonly attempts?: Array<{ provider: MarketProviderId; symbol: string; code: MarketProviderErrorCode }>;

  constructor(
    code: MarketProviderErrorCode,
    provider: MarketProviderId,
    message?: string,
    attempts?: Array<{ provider: MarketProviderId; symbol: string; code: MarketProviderErrorCode }>
  ) {
    super(message ?? code);
    this.name = 'MarketProviderError';
    this.code = code;
    this.provider = provider;
    this.attempts = attempts;
  }
}

export type MarketProviderConfigStatus = 'configured' | 'missing_api_key' | 'disabled';
export interface MarketHistoryPoint {
  date: string;
  close: number;
  high?: number | null;
}

export interface PresetEtfStatus {
  label: string;
  symbol: string;
  currentPrice: number | null;
  athPrice: number | null;
  drawdownPercent: number | null;
  status: MarketOpportunityStatus | 'UNKNOWN';
  fetchedAt: string;
  error?: string;
}

interface MarketDataProvider {
  readonly id: string;
  readonly enabled: boolean;
  fetchSnapshot(input: { symbol: string; athPeriod: AthPeriod }): Promise<{
    currentPrice: number;
    athPrice: number;
    athDate?: string;
    source: string;
  }>;
}

const ALPHA_VANTAGE_SYMBOL_OVERRIDES: Record<string, string> = {
  // Prévu pour gérer les écarts de symbole broker/provider
  // Exemple futur: 'XYZ.PA': 'XYZ',
};
const YAHOO_API_SYMBOL_OVERRIDES: Record<string, string> = {};

export function resolveProviderSymbol(symbol: string, provider: MarketProviderId): string {
  const normalized = (symbol || '').trim();
  if (!normalized) return normalized;
  if (provider === 'alpha-vantage') {
    return ALPHA_VANTAGE_SYMBOL_OVERRIDES[normalized] ?? normalized;
  }
  if (provider === 'yahoo-api') {
    return YAHOO_API_SYMBOL_OVERRIDES[normalized] ?? normalized;
  }
  return normalized;
}

class YahooApiMarketDataProvider implements MarketDataProvider {
  readonly id = 'yahoo-api' as MarketProviderId;
  readonly enabled = process.env.NEXT_PUBLIC_MARKET_PROVIDER_ENABLED !== 'false';

  async fetchSnapshot(input: { symbol: string; athPeriod: AthPeriod }): Promise<{
    currentPrice: number;
    athPrice: number;
    athDate?: string;
    source: string;
  }> {
    const symbol = resolveProviderSymbol(input.symbol, this.id);
    let response: Response;
    try {
      response = await fetch(
        `/api/market/yahoo?symbol=${encodeURIComponent(symbol)}&athPeriod=${encodeURIComponent(input.athPeriod)}`,
        {
          method: 'GET',
          cache: 'no-store',
        }
      );
    } catch {
      throw new MarketProviderError('NETWORK_ERROR', this.id);
    }
    if (!response.ok) {
      throw new MarketProviderError('NETWORK_ERROR', this.id, `HTTP_${response.status}`);
    }
    const json = await response.json();
    if (json?.errorCode && typeof json.errorCode === 'string') {
      throw new MarketProviderError(json.errorCode as MarketProviderErrorCode, this.id);
    }
    const currentPrice = Number(json?.currentPrice);
    const athPrice = Number(json?.athPrice);
    if (!Number.isFinite(currentPrice) || !Number.isFinite(athPrice) || currentPrice <= 0 || athPrice <= 0) {
      throw new MarketProviderError('INCOMPLETE_DATA', this.id);
    }
    return {
      currentPrice,
      athPrice,
      athDate: typeof json?.athDate === 'string' ? json.athDate : undefined,
      source: this.id,
    };
  }
}

class AlphaVantageMarketDataProvider implements MarketDataProvider {
  readonly id = 'alpha-vantage';
  readonly enabled =
    process.env.NEXT_PUBLIC_MARKET_PROVIDER_ENABLED !== 'false' &&
    Boolean(process.env.NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY);
  private readonly apiKey = process.env.NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY ?? '';
  private readonly minIntervalMs = 10_000;
  private lastCallAt = 0;

  private resolvePeriodStart(period: AthPeriod): Date | null {
    const now = new Date();
    if (period === 'MAX') return null;
    const years = period === '5Y' ? 5 : 10;
    const start = new Date(now);
    start.setFullYear(now.getFullYear() - years);
    return start;
  }

  private enforceRateLimit(): void {
    const now = Date.now();
    if (now - this.lastCallAt < this.minIntervalMs) {
      throw new MarketProviderError('RATE_LIMIT_LOCAL', this.id);
    }
    this.lastCallAt = now;
  }

  async fetchSnapshot(input: { symbol: string; athPeriod: AthPeriod }): Promise<{
    currentPrice: number;
    athPrice: number;
    athDate?: string;
    source: string;
  }> {
    this.enforceRateLimit();
    const providerSymbol = resolveProviderSymbol(input.symbol, this.id);
    const url = new URL('https://www.alphavantage.co/query');
    url.searchParams.set('function', 'TIME_SERIES_DAILY_ADJUSTED');
    url.searchParams.set('symbol', providerSymbol);
    url.searchParams.set('apikey', this.apiKey);
    url.searchParams.set('outputsize', 'full');
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        cache: 'no-store',
      });
    } catch {
      throw new MarketProviderError('NETWORK_ERROR', this.id);
    }

    if (!response.ok) {
      throw new MarketProviderError('NETWORK_ERROR', this.id, `HTTP_${response.status}`);
    }

    const json = await response.json();
    if (json?.Note || json?.Information || json?.['Error Message']) {
      const message = String(json?.Note || json?.Information || json?.['Error Message'] || '');
      if (message.toLowerCase().includes('call frequency') || message.toLowerCase().includes('rate')) {
        throw new MarketProviderError('RATE_LIMIT_REMOTE', this.id);
      }
      throw new MarketProviderError('SYMBOL_NOT_FOUND', this.id);
    }
    const series = json?.['Time Series (Daily)'] as Record<string, Record<string, string>> | undefined;
    if (!series || typeof series !== 'object') {
      throw new MarketProviderError('SYMBOL_NOT_FOUND', this.id);
    }
    const minDate = this.resolvePeriodStart(input.athPeriod);
    const points = Object.entries(series)
      .map(([date, values]) => ({
        date,
        high: Number(values?.['2. high']),
        close: Number(values?.['4. close']),
      }))
      .filter((point) => Number.isFinite(point.high) && Number.isFinite(point.close))
      .filter((point) => {
        if (!minDate) return true;
        const pointDate = new Date(`${point.date}T00:00:00.000Z`);
        return pointDate >= minDate;
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    if (points.length === 0) {
      throw new MarketProviderError('INCOMPLETE_DATA', this.id);
    }

    const athPoint = points.reduce((max, current) => (current.high > max.high ? current : max), points[0]);
    const currentPrice = points[points.length - 1].close;

    if (athPoint.high <= 0 || currentPrice <= 0) {
      throw new MarketProviderError('INCOMPLETE_DATA', this.id);
    }

    return {
      currentPrice,
      athPrice: athPoint.high,
      athDate: new Date(`${athPoint.date}T00:00:00.000Z`).toISOString(),
      source: this.id,
    };
  }
}

export class MarketDataService {
  private readonly primaryProvider: MarketDataProvider = new AlphaVantageMarketDataProvider();
  private readonly secondaryProvider: MarketDataProvider = new YahooApiMarketDataProvider();
  private readonly yahooRouteCache = new Map<string, { expiresAt: number; payload: unknown }>();
  private readonly yahooRouteInFlight = new Map<string, Promise<unknown>>();
  private readonly presetStatusesCache = new Map<string, { expiresAt: number; payload: PresetEtfStatus[] }>();
  private readonly presetStatusesInFlight = new Map<string, Promise<PresetEtfStatus[]>>();
  private readonly loggedDebugKeys = new Set<string>();

  private yahooRouteCacheKey(symbol: string, athPeriod: AthPeriod): string {
    return `${symbol.toUpperCase()}::${athPeriod.toUpperCase()}`;
  }

  private resolveYahooRouteTtlMs(): number {
    return process.env.NODE_ENV === 'development' ? 2 * 60 * 1000 : 10 * 60 * 1000;
  }

  private resolvePresetStatusesTtlMs(): number {
    return 24 * 60 * 60 * 1000;
  }

  private logDebugOnce(scope: string, debugPayload: unknown): void {
    if (process.env.NODE_ENV !== 'development' || !debugPayload || typeof debugPayload !== 'object') return;
    const candidate = debugPayload as { symbol?: string; athPeriod?: string; athDate?: string | null };
    const key = `${scope}:${candidate.symbol ?? 'unknown'}:${candidate.athPeriod ?? 'unknown'}:${candidate.athDate ?? 'na'}`;
    if (this.loggedDebugKeys.has(key)) return;
    this.loggedDebugKeys.add(key);
    console.log(scope, debugPayload);
  }

  private async fetchYahooRoute(
    input: { symbol: string; athPeriod: AthPeriod },
    options?: { includeHistory?: boolean }
  ): Promise<unknown> {
    const includeHistory = options?.includeHistory ?? true;
    const key = this.yahooRouteCacheKey(input.symbol, input.athPeriod);
    const cached = this.yahooRouteCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      const cachedPayload = cached.payload as { history?: unknown };
      if (!includeHistory || Array.isArray(cachedPayload?.history)) {
        return cached.payload;
      }
    }

    const inFlight = this.yahooRouteInFlight.get(key);
    if (inFlight) {
      const inFlightPayload = (await inFlight) as { history?: unknown };
      if (!includeHistory || Array.isArray(inFlightPayload?.history)) {
        return inFlightPayload;
      }
    }

    const requestPromise = (async () => {
      const response = await fetch(
        `/api/market/yahoo?symbol=${encodeURIComponent(input.symbol)}&athPeriod=${encodeURIComponent(input.athPeriod)}${
          includeHistory ? '' : '&includeHistory=0'
        }`,
        { method: 'GET', cache: 'no-store' }
      );
      if (!response.ok) {
        throw new Error(`HTTP_${response.status}`);
      }
      const payload = await response.json();
      this.yahooRouteCache.set(key, {
        expiresAt: Date.now() + this.resolveYahooRouteTtlMs(),
        payload,
      });
      return payload;
    })();

    this.yahooRouteInFlight.set(key, requestPromise);
    try {
      return await requestPromise;
    } finally {
      this.yahooRouteInFlight.delete(key);
    }
  }

  async fetchMarketSnapshot(input: { symbol: string; athPeriod: AthPeriod }): Promise<{
    snapshot: MarketSnapshot;
    diagnostics: {
      attemptedProviders: string[];
      usedProvider: string;
      providerSymbol: string;
      fallbackUsed: boolean;
      fallbackError?: string;
    };
  }> {
    const attempts: Array<{ provider: MarketProviderId; symbol: string; code: MarketProviderErrorCode }> = [];
    const providers = [this.primaryProvider, this.secondaryProvider];
    let fallbackError: string | undefined;

    for (const provider of providers) {
      const providerId = provider.id;
      const providerSymbol = resolveProviderSymbol(input.symbol, providerId);
      if (!provider.enabled) {
        const code: MarketProviderErrorCode =
          providerId === 'alpha-vantage' && !process.env.NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY
            ? 'API_KEY_MISSING'
            : 'PROVIDER_DISABLED';
        attempts.push({ provider: providerId, symbol: providerSymbol, code });
        fallbackError = mapMarketProviderErrorToMessage(new MarketProviderError(code, providerId));
        continue;
      }

      try {
        const raw = await provider.fetchSnapshot({ symbol: input.symbol, athPeriod: input.athPeriod });
        const snapshot: MarketSnapshot = {
          id: `remote:${input.symbol}`,
          organizationId: '',
          symbol: input.symbol,
          currentPrice: raw.currentPrice,
          athPrice: raw.athPrice,
          drawdownPercent: computeDrawdownPercent(raw.currentPrice, raw.athPrice),
          athDate: raw.athDate ?? null,
          fetchedAt: new Date().toISOString(),
          source: raw.source,
        };
        return {
          snapshot,
          diagnostics: {
            attemptedProviders: attempts.map((a) => a.provider).concat(providerId),
            usedProvider: providerId,
            providerSymbol,
            fallbackUsed: providerId !== this.primaryProvider.id,
            fallbackError,
          },
        };
      } catch (error) {
        const normalizedError =
          error instanceof MarketProviderError
            ? error
            : new MarketProviderError('UNKNOWN_PROVIDER_ERROR', providerId);
        attempts.push({ provider: providerId, symbol: providerSymbol, code: normalizedError.code });
        fallbackError = mapMarketProviderErrorToMessage(normalizedError);

        const canFallback =
          providerId === this.primaryProvider.id &&
          (normalizedError.code === 'SYMBOL_NOT_FOUND' || normalizedError.code === 'INCOMPLETE_DATA');
        if (canFallback) {
          continue;
        }
        throw new MarketProviderError(normalizedError.code, providerId, normalizedError.message, attempts);
      }
    }

    const last = attempts[attempts.length - 1];
    const finalCode = last?.code ?? 'UNKNOWN_PROVIDER_ERROR';
    const finalProvider = (last?.provider ?? 'alpha-vantage') as MarketProviderId;
    throw new MarketProviderError(finalCode, finalProvider, finalCode, attempts);
  }

  getProviderAttemptDiagnostics(error: unknown): {
    attemptedProviders: string[];
    providerSymbol: string;
    fallbackError?: string;
  } | null {
    if (!(error instanceof MarketProviderError) || !error.attempts) return null;
    const last = error.attempts[error.attempts.length - 1];
    return {
      attemptedProviders: error.attempts.map((a) => a.provider),
      providerSymbol: last?.symbol ?? '',
      fallbackError: mapMarketProviderErrorToMessage(error),
    };
  }

  createManualSnapshot(input: {
    organizationId: string;
    symbol: string;
    currentPrice: number;
    athPrice: number;
    athDate?: string;
    source?: string;
  }): MarketSnapshot {
    const now = new Date().toISOString();
    return {
      id: `${input.organizationId}:${input.symbol}`,
      organizationId: input.organizationId,
      symbol: input.symbol,
      currentPrice: input.currentPrice,
      athPrice: input.athPrice,
      drawdownPercent: computeDrawdownPercent(input.currentPrice, input.athPrice),
      athDate: input.athDate ?? null,
      fetchedAt: now,
      source: input.source ?? 'manual',
    };
  }

  async fetchYahooHistory(input: { symbol: string; athPeriod: AthPeriod }): Promise<MarketHistoryPoint[]> {
    const symbol = resolveProviderSymbol(input.symbol, 'yahoo-api');
    try {
      const json = (await this.fetchYahooRoute(
        { symbol, athPeriod: input.athPeriod },
        { includeHistory: true }
      )) as { errorCode?: string; history?: unknown };
      if (json?.errorCode) return [];
      if (!Array.isArray(json?.history)) return [];
      return json.history
        .map((point: { date?: unknown; close?: unknown; high?: unknown }) => ({
          date: typeof point?.date === 'string' ? point.date : '',
          close: Number(point?.close),
          high: point?.high == null ? null : Number(point.high),
        }))
        .filter((point: MarketHistoryPoint) => Boolean(point.date) && Number.isFinite(point.close) && point.close > 0);
    } catch {
      return [];
    }
  }

  async fetchPresetEtfStatuses(
    settings: Pick<InvestmentSettings, 'athPeriod' | 'reinforce10Threshold' | 'reinforce20Threshold'>
  ): Promise<PresetEtfStatus[]> {
    const cacheKey = `${settings.athPeriod}:${settings.reinforce10Threshold}:${settings.reinforce20Threshold}`;
    const cached = this.presetStatusesCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.payload;
    }
    const inFlight = this.presetStatusesInFlight.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const fetchedAt = new Date().toISOString();
    const requestPromise = Promise.all(
      ETF_REFERENCE_ALIASES.map(async (alias) => {
        const symbol = alias.defaultProviderSymbol;
        try {
          const json = (await this.fetchYahooRoute(
            { symbol, athPeriod: settings.athPeriod },
            { includeHistory: false }
          )) as { errorCode?: string; currentPrice?: unknown; athPrice?: unknown; debug?: unknown };
          this.logDebugOnce('[MarketDebug][PresetETF]', json?.debug);
          if (json?.errorCode) {
            return {
              label: alias.label,
              symbol,
              currentPrice: null,
              athPrice: null,
              drawdownPercent: null,
              status: 'UNKNOWN',
              fetchedAt,
              error: String(json.errorCode),
            } satisfies PresetEtfStatus;
          }
          const currentPrice = Number(json?.currentPrice);
          const athPrice = Number(json?.athPrice);
          if (!Number.isFinite(currentPrice) || !Number.isFinite(athPrice) || currentPrice <= 0 || athPrice <= 0) {
            return {
              label: alias.label,
              symbol,
              currentPrice: null,
              athPrice: null,
              drawdownPercent: null,
              status: 'UNKNOWN',
              fetchedAt,
              error: 'INCOMPLETE_DATA',
            } satisfies PresetEtfStatus;
          }
          const drawdownPercent = computeDrawdownPercent(currentPrice, athPrice);
          return {
            label: alias.label,
            symbol,
            currentPrice,
            athPrice,
            drawdownPercent,
            status: resolveMarketStatus(drawdownPercent, settings),
            fetchedAt,
          } satisfies PresetEtfStatus;
        } catch {
          return {
            label: alias.label,
            symbol,
            currentPrice: null,
            athPrice: null,
            drawdownPercent: null,
            status: 'UNKNOWN',
            fetchedAt,
            error: 'NETWORK_ERROR',
          } satisfies PresetEtfStatus;
        }
      })
    );

    this.presetStatusesInFlight.set(cacheKey, requestPromise);
    try {
      const results = await requestPromise;
      this.presetStatusesCache.set(cacheKey, {
        payload: results,
        expiresAt: Date.now() + this.resolvePresetStatusesTtlMs(),
      });
      return results;
    } finally {
      this.presetStatusesInFlight.delete(cacheKey);
    }
  }
}

export const marketDataService = new MarketDataService();

export function getMarketProviderConfigState(): {
  provider: MarketProviderId;
  status: MarketProviderConfigStatus;
  enabledByFlag: boolean;
  hasApiKey: boolean;
} {
  const enabledByFlag = process.env.NEXT_PUBLIC_MARKET_PROVIDER_ENABLED !== 'false';
  const hasApiKey = Boolean(process.env.NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY);
  const status: MarketProviderConfigStatus = !enabledByFlag
    ? 'disabled'
    : hasApiKey
      ? 'configured'
      : 'missing_api_key';

  return {
    provider: 'alpha-vantage',
    status,
    enabledByFlag,
    hasApiKey,
  };
}

export function mapMarketProviderErrorToMessage(error: unknown): string {
  if (!(error instanceof MarketProviderError)) {
    return 'Données marché indisponibles — saisie manuelle possible';
  }
  switch (error.code) {
    case 'API_KEY_MISSING':
      return 'Clé API marché absente';
    case 'RATE_LIMIT_LOCAL':
    case 'RATE_LIMIT_REMOTE':
      return 'Limite de récupération atteinte. Réessayez plus tard ou utilisez la saisie manuelle.';
    case 'SYMBOL_NOT_FOUND':
      return 'Symbole non trouvé par le provider';
    case 'INCOMPLETE_DATA':
      return 'Données marché incomplètes — saisie manuelle possible';
    case 'NETWORK_ERROR':
      return 'Données marché indisponibles — saisie manuelle possible';
    case 'PROVIDER_DISABLED':
      return 'Données marché indisponibles — saisie manuelle possible';
    default:
      return 'Données marché indisponibles — saisie manuelle possible';
  }
}

