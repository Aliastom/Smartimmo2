import type { PortfolioAccount } from '@/features/market/portfolio/portfolioTypes';
import type { InvestmentDecisionType, InvestmentSettings, MarketSnapshot } from '@/features/market/types';
import type {
  InvestmentJournalMarketContext,
  InvestmentJournalRecommendationKind,
} from '@/features/market/investmentJournalTypes';

export type ValidateOrderBlockReason = 'missing_price' | 'zero_amount' | 'no_account' | 'invalid_amount';

export function pickDefaultPortfolioAccount(
  accounts: PortfolioAccount[],
  envelope: InvestmentSettings['envelope']
): string | null {
  if (accounts.length === 0) return null;
  const match = accounts.find((a) => a.kind === envelope);
  return match?.id ?? accounts[0]?.id ?? null;
}

export function mapDecisionTypeToRecommendationKind(decisionType: InvestmentDecisionType): InvestmentJournalRecommendationKind {
  if (decisionType === 'DCA_ONLY') return 'DCA';
  if (
    decisionType === 'LIGHT_REINFORCE' ||
    decisionType === 'MEDIUM_REINFORCE' ||
    decisionType === 'STRONG_REINFORCE'
  ) {
    return 'REINFORCE';
  }
  return 'NONE';
}

export function buildJournalMarketContext(
  snapshot: MarketSnapshot,
  settings: InvestmentSettings
): InvestmentJournalMarketContext {
  return {
    price: Number.isFinite(snapshot.currentPrice) ? snapshot.currentPrice : null,
    ath: Number.isFinite(snapshot.athPrice) ? snapshot.athPrice : null,
    drawdownPct: Number.isFinite(snapshot.drawdownPercent) ? snapshot.drawdownPercent : null,
    period: settings.athPeriod,
    cashAvailable: settings.availableCash,
  };
}

export function resolveUnitPriceForValidation(
  snapshot: MarketSnapshot,
  manualPrice: number | null | undefined
): number | null {
  if (manualPrice != null && Number.isFinite(manualPrice) && manualPrice > 0) {
    return manualPrice;
  }
  const p = snapshot.currentPrice;
  if (Number.isFinite(p) && p > 0) return p;
  return null;
}

export function computeBuyQuantity(amountEuro: number, unitPrice: number): number {
  if (!(amountEuro > 0) || !(unitPrice > 0)) return 0;
  return Math.round((amountEuro / unitPrice) * 100_000) / 100_000;
}

export function canValidateLocalBuyOrder(input: {
  amountEuro: number;
  unitPrice: number | null;
  accountId: string | null;
}): { ok: true } | { ok: false; reason: ValidateOrderBlockReason } {
  if (!input.accountId) return { ok: false, reason: 'no_account' };
  if (!Number.isFinite(input.amountEuro) || input.amountEuro <= 0) return { ok: false, reason: 'zero_amount' };
  if (input.unitPrice == null || !Number.isFinite(input.unitPrice) || input.unitPrice <= 0) {
    return { ok: false, reason: 'missing_price' };
  }
  return { ok: true };
}
