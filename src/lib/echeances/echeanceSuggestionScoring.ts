/**
 * Scoring de suggestions de rapprochement échéance ↔ transaction (phase 3).
 * Critères simples : même bien, même bail, même sens, montant proche, date proche, libellé proche.
 * Niveaux : FORT / PROBABLE / FAIBLE. Pas d'auto-liaison opaque.
 */

import type { EcheanceSuggestionLevel } from '@/types/echeance';
import { defaultEcheanceLinkConfig, type EcheanceLinkConfig } from '@/lib/echeances/echeanceLinkConfig';

export interface TransactionForScoring {
  id: string;
  propertyId: string;
  leaseId?: string | null;
  amount: number;
  date: string;
  label: string;
  nature?: string | null;
}

export interface EcheanceForScoring {
  id: string;
  propertyId: string | null;
  leaseId?: string | null;
  montant: number;
  sens: string;
  label: string;
  type: string;
  /** YYYY-MM-DD prochaine occurrence si connue */
  nextOccurrenceDate?: string | null;
}

export interface SuggestionReason {
  key: string;
  label: string;
  weight: number;
}

export interface ScoredSuggestion<T> {
  item: T;
  score: number;
  level: EcheanceSuggestionLevel;
  reasons: SuggestionReason[];
}

function daysBetween(a: string, b: string): number {
  const t0 = new Date(a.slice(0, 10) + 'T12:00:00').getTime();
  const t1 = new Date(b.slice(0, 10) + 'T12:00:00').getTime();
  return Math.round(Math.abs(t1 - t0) / (24 * 60 * 60 * 1000));
}

function sensFromNature(nature?: string | null): 'CREDIT' | 'DEBIT' {
  return nature?.toUpperCase().startsWith('RECETTE') ? 'CREDIT' : 'DEBIT';
}

function normalizeLabel(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ');
}

/** Poids bonus type compatible (ex. taxe ↔ taxe). */
export const TYPE_COMPATIBILITY_BONUS = 0.2;
/** Poids pénalité type incompatible (ex. taxe ↔ EDF). */
export const TYPE_COMPATIBILITY_PENALTY = 0.4;

/**
 * Score de compatibilité métier par type : bonus si types cohérents, pénalité si incohérents.
 * Ex. taxe ↔ taxe → +0.2 ; taxe ↔ EDF → -0.4.
 */
export function getTypeCompatibilityScore(
  echeanceType: string,
  tx: { label?: string | null; nature?: string | null }
): { score: number; reason?: SuggestionReason } {
  const typeUp = (echeanceType || '').toUpperCase();
  const label = normalizeLabel((tx.label || '') + ' ' + (tx.nature || ''));

  const isTaxEcheance = ['IMPOT', 'CFE'].includes(typeUp);
  const isRentEcheance = typeUp === 'LOYER_ATTENDU';
  const isInsuranceEcheance = typeUp === 'ASSURANCE';
  const isChargeRecup = typeUp === 'CHARGE_RECUP';

  const looksLikeTax = /\b(taxe|impot|impôt|cfe|foncier)\b/.test(label);
  const looksLikeRent = /\b(loyer|recette)\b/.test(label) || (tx.nature || '').toUpperCase().startsWith('RECETTE');
  const looksLikeInsurance = /\b(assurance|assur)\b/.test(label);
  const looksLikeUtility = /\b(edf|électricité|gaz|eau|charges)\b/.test(label);

  if (isTaxEcheance && looksLikeTax) {
    return { score: TYPE_COMPATIBILITY_BONUS, reason: { key: 'type_compatible', label: 'Type cohérent (taxe)', weight: TYPE_COMPATIBILITY_BONUS } };
  }
  if (isTaxEcheance && looksLikeUtility) {
    return { score: -TYPE_COMPATIBILITY_PENALTY, reason: { key: 'type_incompatible', label: 'Type incohérent (taxe vs charge)', weight: -TYPE_COMPATIBILITY_PENALTY } };
  }
  if (isRentEcheance && looksLikeRent) {
    return { score: TYPE_COMPATIBILITY_BONUS, reason: { key: 'type_compatible', label: 'Type cohérent (loyer)', weight: TYPE_COMPATIBILITY_BONUS } };
  }
  if (isInsuranceEcheance && looksLikeInsurance) {
    return { score: TYPE_COMPATIBILITY_BONUS, reason: { key: 'type_compatible', label: 'Type cohérent (assurance)', weight: TYPE_COMPATIBILITY_BONUS } };
  }
  if (isChargeRecup && (looksLikeRent || /\b(charge|recup)\b/.test(label))) {
    return { score: TYPE_COMPATIBILITY_BONUS, reason: { key: 'type_compatible', label: 'Type cohérent (charge récup.)', weight: TYPE_COMPATIBILITY_BONUS } };
  }
  return { score: 0 };
}

/** Score 0–1 et raisons pour une transaction par rapport à une échéance. */
export function scoreTransactionForEcheance(
  tx: TransactionForScoring,
  echeance: EcheanceForScoring,
  config: EcheanceLinkConfig = defaultEcheanceLinkConfig
): { score: number; reasons: SuggestionReason[] } {
  const reasons: SuggestionReason[] = [];
  let score = 0;
  const maxWeight = 6;

  if (echeance.propertyId && tx.propertyId === echeance.propertyId) {
    reasons.push({ key: 'same_property', label: 'Même bien', weight: 1.5 });
    score += 1.5;
  }

  if (echeance.leaseId && tx.leaseId && echeance.leaseId === tx.leaseId) {
    reasons.push({ key: 'same_lease', label: 'Même bail', weight: 1 });
    score += 1;
  }

  const txSens = sensFromNature(tx.nature);
  const echSens = echeance.sens === 'CREDIT' ? 'CREDIT' : 'DEBIT';
  if (txSens === echSens) {
    reasons.push({ key: 'same_sens', label: 'Même sens', weight: 1 });
    score += 1;
  }

  const amountRatio = echeance.montant > 0 ? Math.abs(tx.amount) / echeance.montant : 0;
  const amountClose = amountRatio >= 1 - config.suggestionAmountTolerancePercent &&
    amountRatio <= 1 + config.suggestionAmountTolerancePercent;
  if (amountClose) {
    reasons.push({ key: 'amount_close', label: 'Montant proche', weight: 1.5 });
    score += 1.5;
  }

  if (echeance.nextOccurrenceDate && tx.date) {
    const days = daysBetween(tx.date, echeance.nextOccurrenceDate);
    if (days <= config.suggestionDateToleranceDays) {
      reasons.push({
        key: 'date_close',
        label: 'Date proche de l\'occurrence',
        weight: 1,
      });
      score += 1;
    }
  }

  const txNorm = normalizeLabel(tx.label);
  const echNorm = normalizeLabel(echeance.label);
  const typeNorm = normalizeLabel(echeance.type);
  if (
    txNorm.includes(echNorm.slice(0, 8)) ||
    echNorm.includes(txNorm.slice(0, 8)) ||
    txNorm.includes(typeNorm.slice(0, 6))
  ) {
    reasons.push({ key: 'label_close', label: 'Libellé proche', weight: 0.5 });
    score += 0.5;
  }

  const typeCompat = getTypeCompatibilityScore(echeance.type, { label: tx.label, nature: tx.nature });
  if (typeCompat.reason) reasons.push(typeCompat.reason);
  score += typeCompat.score;

  const maxScore = maxWeight + TYPE_COMPATIBILITY_BONUS;
  const normalized = Math.max(0, Math.min(1, score / maxScore));
  return { score: normalized, reasons };
}

export function getSuggestionLevel(
  score: number,
  config: EcheanceLinkConfig = defaultEcheanceLinkConfig
): EcheanceSuggestionLevel {
  if (score >= config.thresholdFort) return 'FORT';
  if (score >= config.thresholdProbable) return 'PROBABLE';
  return 'FAIBLE';
}

/**
 * Liste des transactions candidates scorées pour une échéance (FORT + PROBABLE en tête, FAIBLE optionnel).
 */
export function suggestTransactionsForEcheance(
  echeance: EcheanceForScoring,
  candidates: TransactionForScoring[],
  options: { includeFaible?: boolean } = {},
  config: EcheanceLinkConfig = defaultEcheanceLinkConfig
): ScoredSuggestion<TransactionForScoring>[] {
  const alreadyLinkedIds = new Set<string>();
  const scored: ScoredSuggestion<TransactionForScoring>[] = [];

  for (const tx of candidates) {
    const { score, reasons } = scoreTransactionForEcheance(tx, echeance, config);
    const level = getSuggestionLevel(score, config);
    if (level === 'FAIBLE' && !options.includeFaible) continue;
    scored.push({ item: tx, score, level, reasons });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/**
 * Score une échéance par rapport à une transaction (inverse du rapprochement).
 */
export function scoreEcheanceForTransaction(
  echeance: EcheanceForScoring,
  tx: TransactionForScoring,
  config: EcheanceLinkConfig = defaultEcheanceLinkConfig
): { score: number; reasons: SuggestionReason[] } {
  return scoreTransactionForEcheance(tx, echeance, config);
}

/**
 * Liste des échéances candidates scorées pour une transaction.
 */
export function suggestEcheancesForTransaction(
  tx: TransactionForScoring,
  echeances: EcheanceForScoring[],
  options: { includeFaible?: boolean } = {},
  config: EcheanceLinkConfig = defaultEcheanceLinkConfig
): ScoredSuggestion<EcheanceForScoring>[] {
  const scored: ScoredSuggestion<EcheanceForScoring>[] = [];

  for (const ech of echeances) {
    const { score, reasons } = scoreEcheanceForTransaction(ech, tx, config);
    const level = getSuggestionLevel(score, config);
    if (level === 'FAIBLE' && !options.includeFaible) continue;
    scored.push({ item: ech, score, level, reasons });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/** Nombre max de suggestions affichées par défaut (FORT en priorité, puis max 2 PROBABLE). */
export const MAX_SUGGESTIONS_VISIBLE = 3;

/**
 * Réduit la liste à celles visibles par défaut : FORT d'abord, puis au plus 2 PROBABLE (max 3).
 */
export function getVisibleSuggestions<T>(
  scored: ScoredSuggestion<T>[]
): { visible: ScoredSuggestion<T>[]; hasMore: boolean } {
  const fort = scored.filter((s) => s.level === 'FORT');
  const probable = scored.filter((s) => s.level === 'PROBABLE');
  const visible = [...fort, ...probable.slice(0, 2)].slice(0, MAX_SUGGESTIONS_VISIBLE);
  return { visible, hasMore: scored.length > visible.length };
}
