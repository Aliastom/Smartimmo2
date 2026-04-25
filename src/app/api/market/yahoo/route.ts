import { NextRequest, NextResponse } from 'next/server';

interface YahooRouteSuccessPayload {
  currentPrice: number;
  athPrice: number;
  athDate: string | null;
  source: 'yahoo-api';
  debug?: {
    symbol: string;
    athPeriod: string;
    rangeUsed: string;
    intervalUsed: string;
    pointsCount: number;
    firstDate: string | null;
    lastDate: string | null;
    currentPrice: number;
    currentDate: string | null;
    athPrice: number;
    athDate: string | null;
    athSource: 'high' | 'close';
    minClose: number | null;
    maxClose: number | null;
    computedDrawdownPercent: number;
  };
  history?: Array<{ date: string; close: number; high: number | null }>;
}

const YAHOO_ROUTE_CACHE = new Map<string, { expiresAt: number; payload: YahooRouteSuccessPayload }>();
const YAHOO_ROUTE_IN_FLIGHT = new Map<string, Promise<YahooRouteSuccessPayload | { errorCode: string }>>();

function periodToRange(period: string): string {
  if (period === '5Y') return '5y';
  if (period === '10Y') return '10y';
  return 'max';
}

function buildCacheKey(symbol: string, athPeriod: string): string {
  return `${symbol.toUpperCase()}::${athPeriod.toUpperCase()}`;
}

function resolveTtlMs(): number {
  return process.env.NODE_ENV === 'development' ? 15 * 60 * 1000 : 60 * 60 * 1000;
}

function withHistoryPreference(payload: YahooRouteSuccessPayload, includeHistory: boolean): YahooRouteSuccessPayload {
  if (includeHistory) return payload;
  const { history, ...rest } = payload;
  return rest;
}

export async function GET(request: NextRequest) {
  const symbol = (request.nextUrl.searchParams.get('symbol') || '').trim();
  const athPeriod = (request.nextUrl.searchParams.get('athPeriod') || 'MAX').trim();
  const includeHistory = request.nextUrl.searchParams.get('includeHistory') !== '0';

  if (!symbol) {
    return NextResponse.json({ errorCode: 'SYMBOL_NOT_FOUND' }, { status: 200 });
  }

  const range = periodToRange(athPeriod);
  const interval = '1d';
  const cacheKey = buildCacheKey(symbol, athPeriod);
  const cached = YAHOO_ROUTE_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(withHistoryPreference(cached.payload, includeHistory), { status: 200 });
  }

  const existingPromise = YAHOO_ROUTE_IN_FLIGHT.get(cacheKey);
  const requestPromise =
    existingPromise ??
    (async (): Promise<YahooRouteSuccessPayload | { errorCode: string }> => {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
      let response: Response;
      try {
        response = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
      } catch {
        return { errorCode: 'NETWORK_ERROR' };
      }

      if (!response.ok) {
        return { errorCode: 'NETWORK_ERROR' };
      }

      const json = await response.json();
      const result = json?.chart?.result?.[0];
      const quote = result?.indicators?.quote?.[0];
      const timestamps: number[] = result?.timestamp ?? [];
      const highs: Array<number | null> = quote?.high ?? [];
      const closes: Array<number | null> = quote?.close ?? [];

      const points = timestamps
        .map((timestamp, index) => {
          const rawHigh = highs[index];
          const rawClose = closes[index];
          const close = typeof rawClose === 'number' && Number.isFinite(rawClose) ? Number(rawClose) : null;
          const high = typeof rawHigh === 'number' && Number.isFinite(rawHigh) ? Number(rawHigh) : null;
          const athCandidate = high ?? close;
          return {
            timestamp,
            high,
            close,
            athCandidate,
          };
        })
        .filter((point) => typeof point.timestamp === 'number' && Number.isFinite(point.timestamp))
        .filter((point) => typeof point.athCandidate === 'number' && Number.isFinite(point.athCandidate) && point.athCandidate > 0);

      if (points.length === 0) {
        return { errorCode: 'SYMBOL_NOT_FOUND' };
      }

      const athPoint = points.reduce((max, current) =>
        (current.athCandidate as number) > (max.athCandidate as number) ? current : max
      , points[0]);
      const closeCandidates = points
        .map((point) => point.close)
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
      const closePoints = points.filter((point): point is typeof point & { close: number } => typeof point.close === 'number' && Number.isFinite(point.close));
      const currentPrice = closeCandidates.length > 0 ? closeCandidates[closeCandidates.length - 1] : null;
      const athPrice = athPoint.athCandidate as number;

      if (!Number.isFinite(currentPrice) || !Number.isFinite(athPrice) || currentPrice <= 0 || athPrice <= 0) {
        return { errorCode: 'INCOMPLETE_DATA' };
      }

      const drawdown = ((currentPrice - athPrice) / athPrice) * 100;
      const firstDate = points[0]?.timestamp ? new Date(points[0].timestamp * 1000).toISOString() : null;
      const lastDate = points[points.length - 1]?.timestamp ? new Date(points[points.length - 1].timestamp * 1000).toISOString() : null;
      const currentDate = closePoints.length > 0 ? new Date(closePoints[closePoints.length - 1].timestamp * 1000).toISOString() : null;
      const athDate = athPoint.timestamp ? new Date(athPoint.timestamp * 1000).toISOString() : null;
      const minClose = closeCandidates.length > 0 ? Math.min(...closeCandidates) : null;
      const maxClose = closeCandidates.length > 0 ? Math.max(...closeCandidates) : null;
      const athSource: 'high' | 'close' = athPoint.high !== null ? 'high' : 'close';
      const debugPayload =
        process.env.NODE_ENV === 'development'
          ? {
              symbol,
              athPeriod,
              rangeUsed: range,
              intervalUsed: interval,
              pointsCount: points.length,
              firstDate,
              lastDate,
              currentPrice,
              currentDate,
              athPrice,
              athDate,
              athSource,
              minClose,
              maxClose,
              computedDrawdownPercent: Number(drawdown.toFixed(6)),
            }
          : undefined;

      const history = points
        .filter((point) => typeof point.timestamp === 'number' && Number.isFinite(point.timestamp))
        .map((point) => ({
          date: new Date((point.timestamp as number) * 1000).toISOString(),
          close: typeof point.close === 'number' && Number.isFinite(point.close) ? Number(point.close) : Number(point.athCandidate),
          high: typeof point.high === 'number' && Number.isFinite(point.high) ? Number(point.high) : null,
        }))
        .filter((point) => Number.isFinite(point.close) && point.close > 0);

      const payload: YahooRouteSuccessPayload = {
        currentPrice,
        athPrice,
        athDate,
        source: 'yahoo-api',
        ...(debugPayload ? { debug: debugPayload } : {}),
        history,
      };
      YAHOO_ROUTE_CACHE.set(cacheKey, {
        payload,
        expiresAt: Date.now() + resolveTtlMs(),
      });
      return payload;
    })();

  if (!existingPromise) {
    YAHOO_ROUTE_IN_FLIGHT.set(cacheKey, requestPromise);
  }

  try {
    const result = await requestPromise;
    if ('errorCode' in result) {
      return NextResponse.json(result, { status: 200 });
    }
    return NextResponse.json(withHistoryPreference(result, includeHistory), { status: 200 });
  } finally {
    if (!existingPromise) {
      YAHOO_ROUTE_IN_FLIGHT.delete(cacheKey);
    }
  }
}

