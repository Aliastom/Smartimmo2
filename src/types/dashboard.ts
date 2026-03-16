/**
 * Types pour le dashboard Patrimoine Global
 */

export type PatrimoineMode = 'realise' | 'prevision' | 'lisse';

export interface PatrimoineKPIs {
  valeurParc: number | null;
  encoursDette: number | null;
  ltv: number | null; // Loan-to-Value en %
  cashflowMois: number | null;
  cashflowAnnuelMoyen: number | null; // Nouveau KPI
  rendementNet: number | null;
  vacancePct: number | null;
}

export interface MonthlySeriesItem {
  month: string; // Format: 'YYYY-MM'
  value: number;
}

export interface RepartitionParBienItem {
  label: string; // Nom du bien
  value: number; // Montant en €
}

export interface AgendaItem {
  date: string; // Format: 'YYYY-MM-DD'
  type: string; // 'loyer' | 'indexation' | 'pret' | 'impots' | 'copro' | 'pno' | 'cfe' | 'entretien'
  label: string;
  amount?: number;
  entity?: {
    kind: 'property' | 'lease' | 'transaction';
    id: string;
  };
}

export interface PatrimoineResponse {
  period: {
    from: string; // Format: 'YYYY-MM'
    to: string; // Format: 'YYYY-MM'
    months: string[]; // Array de 'YYYY-MM'
  };
  kpis: PatrimoineKPIs;
  series: {
    loyers: MonthlySeriesItem[];
    charges: MonthlySeriesItem[];
    cashflow: MonthlySeriesItem[];
  };
  repartitionParBien: RepartitionParBienItem[];
  repartitionParBienLoyers?: RepartitionParBienItem[]; // Répartition pour les loyers
  repartitionParBienCharges?: RepartitionParBienItem[]; // Répartition pour les charges
  repartitionParBienCashflow?: RepartitionParBienItem[]; // Répartition pour le cashflow
  agenda: AgendaItem[];
  insights?: string; // Synthèse IA contextuelle (optionnel)
  /** Performance par bien sur la période (analyse patrimoniale) */
  performanceParBien?: PerformanceParBienItem[];
  /** Timeline financière annuelle (analyse patrimoniale, année sélectionnée) */
  annualTimelineData?: AnnualTimelineMonth[];
}

export interface PatrimoineFilters {
  from: string; // Format: 'YYYY-MM'
  to: string; // Format: 'YYYY-MM'
  mode: PatrimoineMode;
  propertyId?: string;
  type?: 'loyer' | 'charges';
  leaseStatus?: 'ACTIF' | 'RESILIE';
}

/**
 * Types pour le dashboard Mensuel Opérationnel
 */

export interface MonthlyKPIs {
  sommesEncaisses: number; // Somme de toutes les transactions INCOME
  sommesEncaissesRapprochees: number; // Somme des transactions INCOME avec paidAt
  loyersAttendus: number;
  depensesRealisees: number; // Somme de toutes les transactions EXPENSE
  depensesRealiseesRapprochees: number; // Somme des transactions EXPENSE avec paidAt
  cashflow: number;
  tauxEncaissement: number; // En pourcentage (0-100)
  bauxActifs: number;
  documentsEnvoyes: number;
  /** Nombre de loyers attendus (baux actifs concernés) pour affichage Situation du mois */
  nLoyersAttendus?: number;
  /** Nombre de loyers encaissés (transactions loyer rapprochées) pour affichage Situation du mois */
  nLoyersEncaisses?: number;
  // Deltas vs mois précédent
  deltaSommesEncaisses: number;
  deltaDepensesRealisees: number;
  deltaCashflow: number;
  deltaTauxEncaissement: number;
}

export interface LoyerNonEncaisse {
  id: string;
  leaseId: string;
  propertyId: string;
  propertyName: string;
  tenantName: string;
  montant: number;
  dateEcheance: string;
  accountingMonth?: string; // Format YYYY-MM pour identifier le mois impayé
  retardJours: number;
  statut: 'en_retard' | 'a_venir';
}

export interface TransactionNonRapprochee {
  id: string;
  propertyId: string;
  propertyName: string;
  tenantName?: string;
  label: string;
  montant: number;
  date: string;
  accountingMonth?: string; // Format YYYY-MM
  nature?: string;
}

export interface IndexationATraiter {
  id: string;
  leaseId: string;
  propertyName: string;
  tenantName: string;
  dateAnniversaire: string;
  loyerActuel: number;
  indiceRequis: string; // 'IRL' | 'ILAT' | 'ICC'
  loyerPropose?: number;
}

export interface EcheancePret {
  id: string;
  loanId: string;
  propertyName: string;
  dateEcheance: string;
  montantTotal: number;
  capital?: number;
  interets?: number;
  assurance?: number;
  borrowersInfo?: {
    count: number;
    borrowers: Array<{
      name: string;
      share: number | null;
    }>;
  };
}

export interface EcheanceCharge {
  id: string;
  echeanceId: string;
  propertyName?: string;
  label: string;
  type: string;
  dateEcheance: string;
  montant: number;
  recuperable: boolean;
}

export interface BailAEcheance {
  id: string;
  leaseId: string;
  propertyName: string;
  tenantName: string;
  dateFinBail: string;
  joursRestants: number;
}

export interface DocumentAValider {
  id: string;
  documentId: string;
  fileName: string;
  dateUpload: string;
  ocrStatus: string;
  linkedType?: string;
  linkedId?: string;
}

export interface TaskItem {
  id: string;
  type: 'loyer_retard' | 'indexation' | 'pret' | 'charge' | 'bail_echeance' | 'document';
  title: string;
  date: string;
  priority: 'high' | 'medium' | 'low';
  amount?: number;
  entityId?: string;
  entityType?: string;
}

export interface IntraMensuelDataPoint {
  date: string; // Format: 'YYYY-MM-DD'
  encaissements: number;
  depenses: number;
}

export interface CashflowCumuleDataPoint {
  date: string; // Format: 'YYYY-MM-DD'
  cashflow: number;
}

export interface LoyersRetardParMoisDataPoint {
  month: string; // Format: 'YYYY-MM' (accounting_month)
  count: number; // Nombre de loyers en retard
  montant: number; // Montant total en retard
}

export interface MonthlyDashboardData {
  period: {
    month: string; // Format: 'YYYY-MM'
    firstDay: string; // Format: 'YYYY-MM-DD'
    lastDay: string; // Format: 'YYYY-MM-DD'
  };
  kpis: MonthlyKPIs;
  aTraiter: {
    loyersNonEncaisses: LoyerNonEncaisse[];
    relances: LoyerNonEncaisse[]; // Même structure, filtrées par priorité
    transactionsNonRapprochees: TransactionNonRapprochee[];
    indexations: IndexationATraiter[];
    echeancesPrets: EcheancePret[];
    echeancesCharges: EcheanceCharge[];
    bauxAEcheance: BailAEcheance[];
    documentsAValider: DocumentAValider[];
  };
  graph: {
    intraMensuel: IntraMensuelDataPoint[];
    cashflowCumule: CashflowCumuleDataPoint[];
    loyersRetardParMois: LoyersRetardParMoisDataPoint[];
  };
  insights?: string; // Synthèse IA contextuelle (optionnel)
}

export interface MonthlyDashboardFilters {
  month: string; // Format: 'YYYY-MM'
  bienIds?: string[];
  locataireIds?: string[];
  type?: 'INCOME' | 'EXPENSE' | 'ALL';
  statut?: 'paye' | 'en_retard' | 'a_venir' | 'ALL';
  source?: 'loyer' | 'hors_loyer' | 'ALL';
}

/** Un mois de la timeline financière annuelle */
export interface AnnualTimelineMonth {
  month: string; // Format 'YYYY-MM'
  label: string; // Ex: "Janvier"
  loyers_encaisses: number;
  depenses: number;
  cashflow: number;
  cashflow_cumule: number;
}

/** Ligne "Performance par bien" */
export interface PerformanceParBienItem {
  propertyId: string;
  nom: string;
  loyerMensuel: number;
  chargesMensuelles: number;
  cashflowMensuel: number;
  rendementBrutPct: number | null;
  valeurBien: number | null;
}

