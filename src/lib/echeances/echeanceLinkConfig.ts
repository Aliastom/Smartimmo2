/**
 * Configuration centralisée pour la liaison échéance ↔ transaction (phase 3).
 * Pas de magic numbers dispersés : tolérances et seuils métier au même endroit.
 */

/** Tolérance sur le montant pour considérer "couverture suffisante" (GENEREE). */
export const COVERAGE_AMOUNT_TOLERANCE_EUR = 1;

/** Tolérance relative sur le montant (ex. 0.02 = 2%). Utilisée si > COVERAGE_AMOUNT_TOLERANCE_EUR. */
export const COVERAGE_AMOUNT_TOLERANCE_PERCENT = 0.02;

/** Au-delà de ce ratio (somme liée / montant attendu), on considère MONTANT_SUPERIEUR (défaut). */
export const COVERAGE_OVER_LINKED_RATIO = 1.15;

/** Seuil strict (taxe, assurance) → 1.10 */
export const COVERAGE_OVER_LINKED_RATIO_STRICT = 1.1;

/** Seuil souple (loyer) → 1.25 */
export const COVERAGE_OVER_LINKED_RATIO_LOOSE = 1.25;

/** Au-delà de ce ratio, badge "montant supérieur" en rouge (dépassement très important). */
export const COVERAGE_OVER_LINKED_RATIO_CRITICAL = 2;

/** Seuil d'affichage de l'écart dans le tableau (€) : n'afficher "écart ±X €" que si |X| > ce seuil. */
export const COVERAGE_ECART_DISPLAY_THRESHOLD_EUR = 2;

/** Nombre max de jours d'écart pour que une date soit "proche" de l'occurrence (suggestion). */
export const SUGGESTION_DATE_TOLERANCE_DAYS = 45;

/** Écart max en % du montant pour le scoring (ex. 0.1 = 10%). */
export const SUGGESTION_AMOUNT_TOLERANCE_PERCENT = 0.1;

/** Score minimum pour niveau FORT (0–1). */
export const SUGGESTION_THRESHOLD_FORT = 0.75;

/** Score minimum pour niveau PROBABLE (0–1). En dessous = FAIBLE. */
export const SUGGESTION_THRESHOLD_PROBABLE = 0.4;

/** Auto-lier uniquement si suggestion FORT + aucun lien existant + pas d'ambiguïté. Désactivé par défaut. */
export const ALLOW_AUTO_LINK_ON_FORT = false;

export interface EcheanceLinkConfig {
  amountToleranceEur: number;
  amountTolerancePercent: number;
  overLinkedRatio: number;
  overLinkedRatioCritical: number;
  suggestionDateToleranceDays: number;
  suggestionAmountTolerancePercent: number;
  thresholdFort: number;
  thresholdProbable: number;
  allowAutoLinkOnFort: boolean;
  ecartDisplayThresholdEur: number;
}

export const defaultEcheanceLinkConfig: EcheanceLinkConfig = {
  amountToleranceEur: COVERAGE_AMOUNT_TOLERANCE_EUR,
  amountTolerancePercent: COVERAGE_AMOUNT_TOLERANCE_PERCENT,
  overLinkedRatio: COVERAGE_OVER_LINKED_RATIO,
  overLinkedRatioCritical: COVERAGE_OVER_LINKED_RATIO_CRITICAL,
  suggestionDateToleranceDays: SUGGESTION_DATE_TOLERANCE_DAYS,
  suggestionAmountTolerancePercent: SUGGESTION_AMOUNT_TOLERANCE_PERCENT,
  thresholdFort: SUGGESTION_THRESHOLD_FORT,
  thresholdProbable: SUGGESTION_THRESHOLD_PROBABLE,
  allowAutoLinkOnFort: ALLOW_AUTO_LINK_ON_FORT,
  ecartDisplayThresholdEur: COVERAGE_ECART_DISPLAY_THRESHOLD_EUR,
};

/** Types legacy pour seuil strict (taxe, assurance). */
const COVERAGE_STRICT_TYPES = new Set(['IMPOT', 'CFE', 'PNO', 'ASSURANCE']);

/** Natures pour seuil strict. */
const COVERAGE_STRICT_NATURES = new Set(['DEPENSE_TAXE', 'DEPENSE_ASSURANCE']);

/** Types legacy pour seuil souple (loyer). */
const COVERAGE_LOOSE_TYPES = new Set(['LOYER_ATTENDU']);

/** Natures pour seuil souple. */
const COVERAGE_LOOSE_NATURES = new Set(['RECETTE_LOYER']);

/**
 * Retourne le ratio au-delà duquel on considère "montant_superieur".
 * Accepte type legacy (IMPOT, LOYER_ATTENDU...) ou natureCode (DEPENSE_TAXE, RECETTE_LOYER...).
 */
export function getCoverageThresholdByType(echeanceTypeOrNature: string): number {
  if (COVERAGE_STRICT_TYPES.has(echeanceTypeOrNature) || COVERAGE_STRICT_NATURES.has(echeanceTypeOrNature)) {
    return COVERAGE_OVER_LINKED_RATIO_STRICT;
  }
  if (COVERAGE_LOOSE_TYPES.has(echeanceTypeOrNature) || COVERAGE_LOOSE_NATURES.has(echeanceTypeOrNature)) {
    return COVERAGE_OVER_LINKED_RATIO_LOOSE;
  }
  return COVERAGE_OVER_LINKED_RATIO;
}
