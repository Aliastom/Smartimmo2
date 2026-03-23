/**
 * Module Échéances — API publique.
 *
 * Structure logique :
 * - occurrences : projection temporelle (échéance → dates)
 * - coverage : couverture occurrence ↔ transactions
 * - scoring : suggestion / priorité pilotage
 * - insights : KPI, alertes
 *
 * Modèle : Échéance = règle | Occurrence = projection | Transaction = réalisation | Couverture = lien
 */

// Occurrences
export {
  computeOccurrences,
  listTheoreticalOccurrenceDates,
  buildCoveredOccurrenceDates,
  getNextUncoveredOccurrenceDate,
  getNextUncoveredOccurrenceInfo,
  pickPrimaryEcheanceForPilotage,
  countEcheancesWithUncoveredOccurrence,
  filterLinksForOccurrence,
  toEcheanceInput,
} from './echeanceOccurrences';

// Coverage
export {
  computeCoverage,
  computeCoverageForOccurrence,
  transactionToCoverageInput,
  type CoverageResult,
  type LinkedTransactionInput,
  type LinkedTransactionWithDate,
} from './echeanceCoverage';

// Config
export {
  defaultEcheanceLinkConfig,
  getCoverageThresholdByType,
  COVERAGE_OVER_LINKED_RATIO_CRITICAL,
  type EcheanceLinkConfig,
} from './echeanceLinkConfig';

// Cashflow / pilotage
export {
  getNextOccurrenceInfo,
  sumProjected12Months,
  temporalBadgeMeta,
  generationBadgeMeta,
  getStatutGeneration,
  type NextOccurrenceInfo,
} from './echeanceCashflowHelpers';

// Préfill transaction depuis échéance
export {
  buildTransactionFromEcheance,
  buildTransactionPrefillFromEcheance,
  type EcheanceTransactionPrefill,
} from './echeanceTransactionPrefill';

// Migration / nature
export { resolveNatureCodeForEcheance } from './echeanceTypeMigration';
export { getDefaultNatureCodeForEcheanceType } from './echeanceNatureMapping';

// Insights
export {
  computeQualityScore,
  computeAlerts,
  computeSuggestions,
  computeForecastTotals,
  computeDelta,
  computePropertyManagementScore,
  type EcheanceWithCoverage,
  type EcheanceAlert,
  type ProactiveSuggestion,
  type QualityScoreResult,
  type QualityColor,
} from './echeanceInsights';
