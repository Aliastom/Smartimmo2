/**
 * Score de criticité du dashboard et liste d'anomalies pour le bandeau / priorité
 * Règles métier :
 * - +3 pts par loyer en retard
 * - +2 pts si cashflow négatif
 * - +1 pt si > 10 transactions non rapprochées
 * - +2 pts si taux d'encaissement < 80%
 * Score >= 6 → critique, 3-5 → attention, 0-2 → sain
 */

import type { SeverityLevel } from '../theme/severityColors';
import type { MonthlyKPIs } from '@/types/dashboard';
import type { LoyerNonEncaisse, TransactionNonRapprochee, IndexationATraiter, EcheancePret, EcheanceCharge, BailAEcheance, DocumentAValider } from '@/types/dashboard';

export type AnomalyKind =
  | 'loyers_retard'
  | 'transactions_non_rapprochees'
  | 'ecart_contractuel'  // réservé / montant
  | 'indexations_non_appliquees'
  | 'echeances'
  | 'baux_echeance'
  | 'documents_a_valider';

export type AnomalySeverity = 'critical' | 'warning' | 'info';

export interface DashboardAnomaly {
  id: string;
  kind: AnomalyKind;
  severity: AnomalySeverity;
  label: string;
  count?: number;
  amount?: number;
  detail?: string;
}

export interface GravityResult {
  score: number;
  level: SeverityLevel;
  anomalies: DashboardAnomaly[];
}

const POINTS_LOYERS_RETARD = 3;
const POINTS_CASHFLOW_NEGATIF = 2;
const POINTS_TRANSACTIONS_NON_RAPPROCHEES = 1; // appliqué si count > 10
const SEUIL_TRANSACTIONS = 10;
const POINTS_TAUX_ENCAISSEMENT_FAIBLE = 2;
const SEUIL_TAUX_ENCAISSEMENT = 80;

/** Score >= 6 → critical, 3-5 → warning, 0-2 → success (sain) */
export function computeDashboardGravity(params: {
  kpis: MonthlyKPIs;
  relances: LoyerNonEncaisse[];
  transactionsNonRapprochees: TransactionNonRapprochee[];
  indexations: IndexationATraiter[];
  echeancesPrets: EcheancePret[];
  echeancesCharges: EcheanceCharge[];
  bauxAEcheance: BailAEcheance[];
  documentsAValider: DocumentAValider[];
}): GravityResult {
  const {
    kpis,
    relances,
    transactionsNonRapprochees,
    indexations,
    echeancesPrets,
    echeancesCharges,
    bauxAEcheance,
    documentsAValider,
  } = params;

  let score = 0;
  const anomalies: DashboardAnomaly[] = [];

  // Loyers en retard : +3 par occurrence (on plafonne à 9 pts max pour éviter explosion)
  const loyersCount = relances.length;
  if (loyersCount > 0) {
    const pointsLoyers = Math.min(loyersCount * POINTS_LOYERS_RETARD, 9);
    score += pointsLoyers;
    const amount = relances.reduce((s, r) => s + r.montant, 0);
    anomalies.push({
      id: 'loyers_retard',
      kind: 'loyers_retard',
      severity: 'critical',
      label: 'Loyers en retard',
      count: loyersCount,
      amount,
      detail: `${loyersCount} loyer${loyersCount > 1 ? 's' : ''} · ${formatEur(amount)}`,
    });
  }

  // Cashflow négatif
  if (kpis.cashflow < 0) {
    score += POINTS_CASHFLOW_NEGATIF;
    anomalies.push({
      id: 'cashflow_negatif',
      kind: 'ecart_contractuel',
      severity: 'critical',
      label: 'Cashflow négatif',
      amount: kpis.cashflow,
      detail: formatEur(kpis.cashflow),
    });
  }

  // Transactions non rapprochées > 10
  const txCount = transactionsNonRapprochees.length;
  if (txCount > SEUIL_TRANSACTIONS) {
    score += POINTS_TRANSACTIONS_NON_RAPPROCHEES;
    anomalies.push({
      id: 'transactions_non_rapprochees',
      kind: 'transactions_non_rapprochees',
      severity: 'warning',
      label: 'Transactions non rapprochées',
      count: txCount,
      detail: `${txCount} transaction${txCount > 1 ? 's' : ''}`,
    });
  } else if (txCount > 0) {
    anomalies.push({
      id: 'transactions_non_rapprochees',
      kind: 'transactions_non_rapprochees',
      severity: 'warning',
      label: 'Transactions non rapprochées',
      count: txCount,
      detail: `${txCount} transaction${txCount > 1 ? 's' : ''}`,
    });
  }

  // Taux d'encaissement < 80%
  if (kpis.tauxEncaissement < SEUIL_TAUX_ENCAISSEMENT) {
    score += POINTS_TAUX_ENCAISSEMENT_FAIBLE;
    anomalies.push({
      id: 'taux_encaissement',
      kind: 'ecart_contractuel',
      severity: kpis.tauxEncaissement < 60 ? 'critical' : 'warning',
      label: "Taux d'encaissement faible",
      detail: `${kpis.tauxEncaissement.toFixed(1)}%`,
    });
  }

  // Indexations à traiter (anomalie mineure, pas de points)
  if (indexations.length > 0) {
    anomalies.push({
      id: 'indexations',
      kind: 'indexations_non_appliquees',
      severity: 'info',
      label: 'Indexations à appliquer',
      count: indexations.length,
      detail: `${indexations.length} indexation${indexations.length > 1 ? 's' : ''}`,
    });
  }

  // Échéances (informatif)
  const echeancesCount = echeancesPrets.length + echeancesCharges.length;
  if (echeancesCount > 0) {
    anomalies.push({
      id: 'echeances',
      kind: 'echeances',
      severity: 'info',
      label: 'Échéances du mois',
      count: echeancesCount,
      amount: echeancesPrets.reduce((s, p) => s + p.montantTotal, 0) + echeancesCharges.reduce((s, c) => s + c.montant, 0),
      detail: `${echeancesCount} échéance${echeancesCount > 1 ? 's' : ''}`,
    });
  }

  // Baux à échéance
  if (bauxAEcheance.length > 0) {
    anomalies.push({
      id: 'baux_echeance',
      kind: 'baux_echeance',
      severity: bauxAEcheance.some(b => b.joursRestants <= 7) ? 'warning' : 'info',
      label: 'Baux à renouveler',
      count: bauxAEcheance.length,
      detail: `${bauxAEcheance.length} bail${bauxAEcheance.length > 1 ? 'x' : ''}`,
    });
  }

  // Documents à valider
  if (documentsAValider.length > 0) {
    anomalies.push({
      id: 'documents',
      kind: 'documents_a_valider',
      severity: 'info',
      label: 'Documents à valider',
      count: documentsAValider.length,
      detail: `${documentsAValider.length} document${documentsAValider.length > 1 ? 's' : ''}`,
    });
  }

  // Ordre par gravité : critical > warning > info
  const severityOrder: AnomalySeverity[] = ['critical', 'warning', 'info'];
  anomalies.sort((a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity));

  // Niveau global
  let level: SeverityLevel = 'success';
  if (score >= 6) level = 'critical';
  else if (score >= 3) level = 'warning';
  else if (anomalies.length > 0) level = 'warning'; // au moins une anomalie même si score < 3
  // si 0 anomalie, déjà "success"

  return { score, level, anomalies };
}

function formatEur(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
