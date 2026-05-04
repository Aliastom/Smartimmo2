import type { PortfolioOrder } from '@/features/market/portfolio/portfolioTypes';
import { resolveGrossTransactionAmount, sortOrdersChronologically } from '@/features/market/portfolio/portfolioLedgerEngine';

function yearsBetween(fromIso: string, toMs: number): number {
  const t0 = new Date(fromIso).getTime();
  if (!Number.isFinite(t0)) return 0;
  return Math.max(0, (toMs - t0) / (365.25 * 24 * 60 * 60 * 1000));
}

/**
 * Capital investi « actualisé inflation » : chaque sortie nette de cash pour titres est projetée au taux annuel jusqu’à aujourd’hui ;
 * les rentrées (ventes) réduisent ce banc d’essai.
 * Reste à comparer à la valeur de marché actuelle pour un surplus « vs inflation ».
 */
export function inflationAdjustedNetContributionsEuro(params: {
  orders: PortfolioOrder[];
  annualInflationRate: number;
  nowMs: number;
}): number {
  const r = params.annualInflationRate;
  const sorted = sortOrdersChronologically(params.orders);
  let bench = 0;
  for (const o of sorted) {
    const y = yearsBetween(o.date, params.nowMs);
    const factor = Math.pow(1 + r, y);
    const gross = resolveGrossTransactionAmount(o);
    const fees = Math.max(0, o.fees || 0);
    const taxes = Math.max(0, o.taxes || 0);
    switch (o.type) {
      case 'BUY': {
        const out = gross > 0 ? gross + fees : fees;
        bench += out * factor;
        break;
      }
      case 'TRANSFER_IN': {
        const out = gross > 0 ? gross + fees : fees;
        bench += out * factor;
        break;
      }
      case 'SELL': {
        const proceeds = Math.max(0, gross - fees - taxes);
        bench -= proceeds * factor;
        break;
      }
      case 'DIVIDEND':
      case 'FEE':
      case 'TAX':
      case 'TRANSFER_OUT':
      default:
        break;
    }
  }
  return Math.round(bench * 100) / 100;
}

export function surplusVsInflationEuro(params: {
  currentMarketValueTotal: number;
  orders: PortfolioOrder[];
  annualInflationRate: number;
  nowMs: number;
}): number {
  const bench = inflationAdjustedNetContributionsEuro({
    orders: params.orders,
    annualInflationRate: params.annualInflationRate,
    nowMs: params.nowMs,
  });
  return Math.round((params.currentMarketValueTotal - bench) * 100) / 100;
}
