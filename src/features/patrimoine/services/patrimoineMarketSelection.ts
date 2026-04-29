/**
 * Résolution du profil Marché / ETF utilisé par le cockpit Patrimoine (auto vs manuel).
 */

import type { InvestmentSettings } from '@/features/market/types';
import { DEFAULT_MARKET_INVESTMENT_SETTINGS_ID } from '@/features/market/services/marketInvestmentStorage';
import { formatCurrencyEUR } from '@/utils/format';

export type MarketInvestmentSelectionMode = 'AUTO' | 'MANUAL' | 'MISSING_FALLBACK';

export interface PatrimoineAvailableMarketInvestment {
  id: string;
  label: string;
}

export interface ResolvePatrimoineMarketInvestmentResult {
  mode: MarketInvestmentSelectionMode;
  selectedInvestment: InvestmentSettings | null;
  /** Liste normalisée (tri serveur : défaut préféré puis récence). */
  availableInvestments: InvestmentSettings[];
  warning: string | null;
}

export function formatPatrimoineMarketProfileLabel(inv: InvestmentSettings): string {
  const sym = (inv.referenceSymbol || '').trim() || '—';
  const dca =
    typeof inv.monthlyDcaAmount === 'number' && Number.isFinite(inv.monthlyDcaAmount)
      ? inv.monthlyDcaAmount
      : 0;
  const cashRaw =
    typeof inv.cashReferenceAmount === 'number' && Number.isFinite(inv.cashReferenceAmount)
      ? inv.cashReferenceAmount
      : typeof inv.availableCash === 'number' && Number.isFinite(inv.availableCash)
        ? inv.availableCash
        : 0;
  return `${sym} · DCA ${formatCurrencyEUR(dca)} · cash ${formatCurrencyEUR(cashRaw)}`;
}

export function pickAutoMarketInvestment(available: InvestmentSettings[]): InvestmentSettings | null {
  if (available.length === 0) return null;
  const def = available.find((i) => i.id === DEFAULT_MARKET_INVESTMENT_SETTINGS_ID);
  if (def) return def;
  return available[0] ?? null;
}

/**
 * @param availableInvestments — ex. `listAllInvestmentProfilesNormalized` (tri desc `updatedAt`)
 * @param selectedMarketInvestmentId — `null` = automatique (profil défaut ou dernier actif)
 */
export function resolvePatrimoineMarketInvestment(
  availableInvestments: InvestmentSettings[],
  selectedMarketInvestmentId: string | null | undefined
): ResolvePatrimoineMarketInvestmentResult {
  const pref = typeof selectedMarketInvestmentId === 'string' ? selectedMarketInvestmentId.trim() : '';
  const auto = pickAutoMarketInvestment(availableInvestments);

  if (!pref) {
    return {
      mode: 'AUTO',
      selectedInvestment: auto,
      availableInvestments,
      warning: null,
    };
  }

  const found = availableInvestments.find((i) => i.id === pref);
  if (found) {
    return {
      mode: 'MANUAL',
      selectedInvestment: found,
      availableInvestments,
      warning: null,
    };
  }

  return {
    mode: 'MISSING_FALLBACK',
    selectedInvestment: auto,
    availableInvestments,
    warning: 'Introuvable — fallback auto.',
  };
}

export function buildAvailableMarketInvestmentsForPatrimoine(
  rows: InvestmentSettings[]
): PatrimoineAvailableMarketInvestment[] {
  return rows.map((inv) => ({
    id: inv.id,
    label: formatPatrimoineMarketProfileLabel(inv),
  }));
}
