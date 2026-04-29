/**
 * Score d’allocation 0–100 (ETF vs patrimoine total).
 * Cible indicative : ~30 % ETF ; sous 20 % sous-exposition ; au-dessus de 60 % déséquilibre.
 */

export function computeAllocationScore(allocationEtf: number): number {
  if (!Number.isFinite(allocationEtf) || allocationEtf < 0) return 0;
  const a = allocationEtf;

  if (a > 0.6) {
    const excess = a - 0.6;
    return Math.max(15, Math.round((45 - excess * 120) * 100) / 100);
  }

  if (a >= 0.2 && a <= 0.4) {
    const center = 0.3;
    const span = 0.1;
    const dist = Math.abs(a - center);
    const norm = Math.min(1, dist / span);
    return Math.round((100 - norm * 25) * 100) / 100;
  }

  if (a < 0.2) {
    return Math.round((25 + (a / 0.2) * 50) * 100) / 100;
  }

  return Math.round((70 - (a - 0.4) * 75) * 100) / 100;
}
