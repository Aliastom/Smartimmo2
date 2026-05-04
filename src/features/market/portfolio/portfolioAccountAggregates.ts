import type { PortfolioAccount, PortfolioOrder, PortfolioPositionComputed } from '@/features/market/portfolio/portfolioTypes';

export interface PortfolioAccountAggregateRow {
  accountId: string;
  accountName: string;
  kind: PortfolioAccount['kind'];
  currency: string;
  /** Somme des valeurs marché des lignes (0 si cours manquant partout). */
  marketValueEuro: number;
  /** Somme des coûts restants (PRU) des lignes ouvertes. */
  remainingCostBasisEuro: number;
  /** Lignes de position avec quantité > 0. */
  openPositionLines: number;
  /** Nombre d’ordres rattachés au compte. */
  orderCount: number;
}

function kindLabel(kind: PortfolioAccount['kind']): string {
  switch (kind) {
    case 'PEA':
      return 'PEA';
    case 'CTO':
      return 'Compte-titres';
    case 'ASSURANCE_VIE':
      return 'Assurance-vie';
    case 'CRYPTO':
      return 'Crypto';
    case 'AUTRE':
      return 'Autre';
    default:
      return String(kind);
  }
}

export { kindLabel };

/**
 * Agrégats par compte à partir des listes déjà calculées par le hook (aucune logique ledger supplémentaire).
 */
export function buildPortfolioAccountAggregates(
  accounts: PortfolioAccount[],
  positions: PortfolioPositionComputed[],
  orders: PortfolioOrder[]
): PortfolioAccountAggregateRow[] {
  const byAccount = new Map<string, { mv: number; cost: number; lines: number }>();
  for (const a of accounts) {
    byAccount.set(a.id, { mv: 0, cost: 0, lines: 0 });
  }

  for (const p of positions) {
    const bucket = byAccount.get(p.accountId);
    if (!bucket) continue;
    if (p.quantity > 1e-9) {
      bucket.lines += 1;
      bucket.cost += p.remainingCostBasis;
      bucket.mv += p.marketValue ?? 0;
    }
  }

  const orderCountByAccount = new Map<string, number>();
  for (const o of orders) {
    orderCountByAccount.set(o.accountId, (orderCountByAccount.get(o.accountId) ?? 0) + 1);
  }

  return accounts.map((a) => {
    const agg = byAccount.get(a.id) ?? { mv: 0, cost: 0, lines: 0 };
    return {
      accountId: a.id,
      accountName: a.name,
      kind: a.kind,
      currency: a.currency,
      marketValueEuro: agg.mv,
      remainingCostBasisEuro: agg.cost,
      openPositionLines: agg.lines,
      orderCount: orderCountByAccount.get(a.id) ?? 0,
    };
  });
}
