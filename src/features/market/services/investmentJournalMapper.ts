import type { InvestmentActionLog, InvestmentActionStatus } from '@/features/market/types';
import type {
  InvestmentJournalEntry,
  InvestmentJournalEntryType,
  InvestmentJournalRecommendationKind,
  InvestmentJournalSource,
  InvestmentJournalStatus,
} from '@/features/market/investmentJournalTypes';

function mapStatus(log: InvestmentActionLog): InvestmentJournalStatus {
  if (log.status === 'suggested') return 'pending';
  if (log.status === 'validated') return 'validated';
  if (log.status === 'ignored') return 'ignored';
  if (log.status === 'cancelled') return 'cancelled';
  return 'pending';
}

function mapEntryType(log: InvestmentActionLog): InvestmentJournalEntryType {
  if (log.journalEntryType) return log.journalEntryType;
  if (log.portfolioOrderId) return 'RECOMMENDATION';
  if (log.type === 'MANUAL') return 'MANUAL_DECISION';
  return 'RECOMMENDATION';
}

function mapRecommendationKind(log: InvestmentActionLog): InvestmentJournalRecommendationKind {
  if (log.recommendationKind) return log.recommendationKind;
  if (log.type === 'DCA') return 'DCA';
  if (
    log.type === 'REINFORCE_10' ||
    log.type === 'REINFORCE_20' ||
    log.type === 'REINFORCE_30' ||
    log.type === 'REINFORCE_MAX'
  ) {
    return 'REINFORCE';
  }
  return 'NONE';
}

function mapSource(log: InvestmentActionLog): InvestmentJournalSource {
  return log.journalSource ?? 'assistant';
}

export function investmentActionLogToJournalEntry(log: InvestmentActionLog): InvestmentJournalEntry {
  const mc = log.marketContextSnapshot;
  return {
    id: log.id,
    organizationId: log.organizationId,
    type: mapEntryType(log),
    status: mapStatus(log),
    source: mapSource(log),
    symbol: log.symbolAtDecision,
    assetId: log.assetId ?? null,
    accountId: log.portfolioAccountId ?? null,
    orderId: log.portfolioOrderId ?? null,
    amountEuro: log.validatedAmount,
    quantity: log.validatedQuantity ?? null,
    unitPrice: log.validatedUnitPrice ?? null,
    recommendationKind: mapRecommendationKind(log),
    reason: log.reason,
    marketContext: {
      price: mc?.price ?? log.currentPriceAtDecision,
      ath: mc?.ath ?? log.athPriceAtDecision,
      drawdownPct: mc?.drawdownPct ?? log.drawdownAtDecision,
      period: mc?.period ?? log.athPeriodAtDecision,
      cashAvailable: mc?.cashAvailable ?? log.cashBefore,
    },
    createdAt: log.date,
    validatedAt: log.validatedAt ?? (log.status === 'validated' ? log.date : null),
    ignoredAt: log.ignoredAt ?? null,
    note: log.note ?? null,
    actionLogId: log.id,
  };
}

/** Badges UX pour une ligne de journal. */
export function journalEntryBadgeLabels(entry: InvestmentJournalEntry): {
  primary: string;
  variant: 'default' | 'success' | 'warning' | 'secondary';
} {
  if (entry.orderId && entry.status === 'validated') {
    return { primary: 'Ordre créé', variant: 'success' };
  }
  if (entry.status === 'ignored') return { primary: 'Ignoré', variant: 'secondary' };
  if (entry.status === 'cancelled') return { primary: 'Annulé', variant: 'warning' };
  if (entry.status === 'pending') return { primary: 'Recommandation', variant: 'secondary' };
  if (entry.type === 'ORDER_CREATED') return { primary: 'Ordre créé', variant: 'success' };
  return { primary: 'Validé', variant: 'success' };
}

export function isActionLogStatusPending(status: InvestmentActionStatus): boolean {
  return status === 'suggested';
}
