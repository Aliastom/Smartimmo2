/**
 * Logique de couverture échéance ↔ transactions liées (phase 3).
 * Calcule total lié, écart, et dérive le statut de génération (A_GENERER / PARTIELLE / GENEREE / SUR_LIEE).
 */

import type { EcheanceStatutGeneration } from '@/types/echeance';
import {
  defaultEcheanceLinkConfig,
  getCoverageThresholdByType,
  type EcheanceLinkConfig,
} from '@/lib/echeances/echeanceLinkConfig';

export interface LinkedTransactionInput {
  amount: number;
  /** sens de la transaction : CREDIT | DEBIT (aligné avec l'échéance pour être "cohérent") */
  sens: 'CREDIT' | 'DEBIT';
}

export interface CoverageResult {
  /** Somme des montants des transactions liées (signés selon sens : négatif si DEBIT). */
  totalLinked: number;
  /** Nombre de transactions liées. */
  linkedCount: number;
  /** Montant attendu (positif), aligné avec sens échéance. */
  expectedAmount: number;
  /** Écart = totalLinked - expectedAmount (en valeur signée). */
  ecartAbsolu: number;
  /** Écart relatif (0 si expectedAmount 0). */
  ecartRelatif: number;
  /** Statut métier dérivé. */
  statut: EcheanceStatutGeneration;
}

/**
 * Détermine si le montant lié est "dans la tolérance" par rapport à l'attendu.
 */
function isWithinTolerance(
  totalLinked: number,
  expectedAmount: number,
  config: EcheanceLinkConfig
): boolean {
  if (expectedAmount <= 0) return totalLinked <= 0;
  const ecart = Math.abs(totalLinked - expectedAmount);
  const tolEur = config.amountToleranceEur;
  const tolPct = config.amountTolerancePercent * expectedAmount;
  return ecart <= Math.max(tolEur, tolPct);
}

/**
 * Calcule la couverture et le statut de génération à partir des transactions liées.
 * Utilise un seuil dynamique par type d'échéance si echeanceType est fourni.
 */
export function computeCoverage(
  expectedAmount: number,
  sens: 'CREDIT' | 'DEBIT',
  linkedTransactions: LinkedTransactionInput[],
  config: EcheanceLinkConfig = defaultEcheanceLinkConfig,
  echeanceType?: string
): CoverageResult {
  const linkedCount = linkedTransactions.length;
  const totalLinked = linkedTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const expected = Math.abs(expectedAmount);
  const ecartAbsolu = totalLinked - expected;
  const ecartRelatif = expected > 0 ? ecartAbsolu / expected : 0;

  const overLinkedRatio =
    echeanceType != null ? getCoverageThresholdByType(echeanceType) : config.overLinkedRatio;

  let statut: EcheanceStatutGeneration = 'a_generer';

  if (linkedCount === 0) {
    statut = 'a_generer';
  } else if (totalLinked >= expected * overLinkedRatio) {
    statut = 'montant_superieur';
  } else if (isWithinTolerance(totalLinked, expected, config)) {
    statut = 'generee';
  } else if (totalLinked > expected) {
    statut = 'montant_superieur';
  } else {
    statut = 'partielle';
  }

  return {
    totalLinked,
    linkedCount,
    expectedAmount: expected,
    ecartAbsolu,
    ecartRelatif,
    statut,
  };
}

/** Transaction liée avec date pour couverture par occurrence. */
export interface LinkedTransactionWithDate {
  amount: number;
  sens: 'CREDIT' | 'DEBIT';
  date: string;
}

/**
 * Calcule la couverture au niveau d'une occurrence spécifique (Partie 5).
 */
export function computeCoverageForOccurrence(
  expectedAmount: number,
  sens: 'CREDIT' | 'DEBIT',
  linkedTransactions: LinkedTransactionWithDate[],
  occurrenceYmd: string,
  dateToleranceDays: number = 7,
  config: EcheanceLinkConfig = defaultEcheanceLinkConfig,
  echeanceType?: string
): CoverageResult & { transactionsForOccurrence: LinkedTransactionWithDate[] } {
  const filtered = linkedTransactions.filter((t) => {
    const dist = Math.abs(
      (new Date(t.date).getTime() - new Date(occurrenceYmd).getTime()) / (24 * 60 * 60 * 1000)
    );
    return dist <= dateToleranceDays;
  });
  const inputs: LinkedTransactionInput[] = filtered.map((t) => ({ amount: t.amount, sens: t.sens }));
  const result = computeCoverage(
    expectedAmount,
    sens,
    inputs,
    config,
    echeanceType
  );
  return { ...result, transactionsForOccurrence: filtered };
}

/**
 * Convertit une transaction "brute" (montant, nature) en entrée pour computeCoverage.
 * nature type RECETTE => CREDIT, sinon DEBIT.
 */
export function transactionToCoverageInput(
  amount: number,
  natureCode?: string | null
): LinkedTransactionInput {
  const sens: 'CREDIT' | 'DEBIT' =
    natureCode?.toUpperCase().startsWith('RECETTE') ? 'CREDIT' : 'DEBIT';
  return { amount, sens };
}
