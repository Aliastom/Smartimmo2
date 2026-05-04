import type { PortfolioSnapshot } from '@/features/market/portfolio/portfolioTypes';

export const PORTFOLIO_SNAPSHOT_STALE_MS = 12 * 60 * 60 * 1000;

/** Seuil de variation de la valorisation totale vs dernier instantané (option env). */
export const PORTFOLIO_SNAPSHOT_VOLATILITY_THRESHOLD = 0.02;

export function isPortfolioSnapshotOnVolatilityEnabled(): boolean {
  if (typeof process === 'undefined') return false;
  const v = process.env.NEXT_PUBLIC_MARKET_SNAPSHOT_ON_VOLATILITY;
  return v === '1' || v === 'true';
}

function localHourKey(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
  } catch {
    return iso;
  }
}

/** True si un instantané existe déjà pour la même heure locale (évite doublons automatiques). */
export function hasPortfolioSnapshotInSameLocalHour(snapshots: PortfolioSnapshot[], nowMs: number): boolean {
  const nowKey = localHourKey(new Date(nowMs).toISOString());
  return snapshots.some((s) => localHourKey(s.capturedAt) === nowKey);
}

/** Instantanés dont `capturedAt` tombe dans la même heure locale que `nowMs` (correction après ordre / cash). */
export function filterSnapshotsInSameLocalHour(snapshots: PortfolioSnapshot[], nowMs: number): PortfolioSnapshot[] {
  const nowKey = localHourKey(new Date(nowMs).toISOString());
  return snapshots.filter((s) => localHourKey(s.capturedAt) === nowKey);
}

function latestSnapshot(snapshots: PortfolioSnapshot[]): PortfolioSnapshot | null {
  if (snapshots.length === 0) return null;
  return [...snapshots].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt)).at(-1) ?? null;
}

/** Dernier instantané daté de moins de `windowMs` ? */
export function hasRecentPortfolioSnapshot(snapshots: PortfolioSnapshot[], nowMs: number, windowMs: number): boolean {
  const last = latestSnapshot(snapshots);
  if (!last) return false;
  const t = Date.parse(last.capturedAt);
  if (!Number.isFinite(t)) return false;
  return nowMs - t < windowMs;
}

/** Variation relative |nouveau − ancien| / ancien ; ancien nul → pas de déclenchement volatilité. */
export function portfolioTotalValueVolatilityRatio(
  previousTotalMarketValue: number,
  nextTotalMarketValue: number
): number | null {
  const denom = Math.abs(previousTotalMarketValue);
  if (denom < 1e-9) return null;
  return Math.abs(nextTotalMarketValue - previousTotalMarketValue) / denom;
}

export function shouldTriggerVolatilitySnapshot(
  snapshots: PortfolioSnapshot[],
  nextTotalMarketValue: number,
  threshold = PORTFOLIO_SNAPSHOT_VOLATILITY_THRESHOLD
): boolean {
  const last = latestSnapshot(snapshots);
  if (!last) return false;
  const ratio = portfolioTotalValueVolatilityRatio(last.totalMarketValue, nextTotalMarketValue);
  if (ratio == null) return false;
  return ratio > threshold;
}
