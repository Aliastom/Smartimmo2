import type { MarketHistoryPoint } from '@/features/market/services/marketDataService';

/** True si la date du champ type date (`YYYY-MM-DD`) est le jour civil courant (fuseau local). */
export function isYmdCalendarToday(ymd: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const now = new Date();
  return now.getFullYear() === y && now.getMonth() === mo && now.getDate() === d;
}

/** Même référence temporelle que l’enregistrement d’ordre (`T12:00:00.000Z`). */
export function orderYmdToComparableIso(ymd: string): string {
  return new Date(`${ymd.trim()}T12:00:00.000Z`).toISOString();
}

/**
 * Point d’historique le plus proche de la cible (temps absolu).
 * Réutilise la logique métier « décision / date » sans appel réseau.
 */
export function findNearestHistoryPoint(
  history: MarketHistoryPoint[],
  targetIso: string,
): { date: string; close: number } | null {
  const t = new Date(targetIso).getTime();
  if (!Number.isFinite(t)) return null;
  let best: { diff: number; date: string; close: number } | null = null;
  for (const p of history) {
    const pt = new Date(p.date).getTime();
    if (!Number.isFinite(pt) || !Number.isFinite(p.close) || p.close <= 0) continue;
    const diff = Math.abs(pt - t);
    if (!best || diff < best.diff) {
      best = { diff, date: p.date, close: p.close };
    }
  }
  return best ? { date: best.date, close: best.close } : null;
}

export function formatHistoricalBadgeDate(historyDate: string): string {
  const t = Date.parse(historyDate);
  if (!Number.isFinite(t)) return historyDate;
  return new Date(t).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
