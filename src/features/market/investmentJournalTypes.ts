import type { InvestmentMarketContextSnapshot } from '@/features/market/types';

/** Ligne de journal unifiée (vue métier — persistance = InvestmentActionLog + champs optionnels). */
export type InvestmentJournalEntryType = 'RECOMMENDATION' | 'ORDER_CREATED' | 'MANUAL_DECISION';

export type InvestmentJournalStatus = 'pending' | 'validated' | 'ignored' | 'cancelled';

export type InvestmentJournalSource = 'assistant' | 'user' | 'import';

export type InvestmentJournalRecommendationKind = 'DCA' | 'REINFORCE' | 'HOLD' | 'NONE';

export type InvestmentJournalMarketContext = InvestmentMarketContextSnapshot;

export interface InvestmentJournalEntry {
  id: string;
  organizationId: string;
  type: InvestmentJournalEntryType;
  status: InvestmentJournalStatus;
  source: InvestmentJournalSource;
  symbol: string;
  assetId?: string | null;
  accountId?: string | null;
  orderId?: string | null;
  amountEuro: number;
  quantity?: number | null;
  unitPrice?: number | null;
  recommendationKind: InvestmentJournalRecommendationKind;
  reason: string;
  marketContext: InvestmentJournalMarketContext;
  createdAt: string;
  validatedAt?: string | null;
  ignoredAt?: string | null;
  note?: string | null;
  /** Lien vers l’entrée technique legacy (1:1). */
  actionLogId: string;
}
