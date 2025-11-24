/**
 * Types pour les rapports d'anomalies de gestion déléguée
 */

export interface DelegatedManagementReportRequest {
  gestionnaireId: string;
  period: {
    from: string; // ISO date
    to: string;   // ISO date
  };
  include: {
    lateRents: boolean;
    unmatchedTransactions: boolean;
    amountGaps: boolean;
    missingIndexations: boolean;
  };
}

export interface DelegatedManagementReportData {
  gestionnaire: {
    id: string;
    name: string;
    email?: string;
  };
  period: {
    from: Date;
    to: Date;
  };
  summary: {
    totalLateRents: number;
    totalLateRentsAmount: number;
    totalUnmatchedTransactions: number;
    totalUnmatchedAmount: number;
    totalAmountGapsCases: number;
    totalAmountGapsValue: number;
    totalMissingIndexationsCases: number;
    totalMissingIndexationsAmount: number;
    totalBaux: number;
  };
  lateRents: Array<{
    bienLabel: string;
    bailLabel: string;
    locataireName: string;
    month: string; // ex: "novembre 2025"
    dueAmount: number;
    paidAmount: number;
    delayInDays?: number;
  }>;
  unmatchedTransactions: Array<{
    date: Date;
    label: string;
    amount: number;
    potentialBien?: string;
    potentialLocataire?: string;
  }>;
  amountGaps: Array<{
    bienLabel: string;
    locataireName: string;
    month: string;
    expectedAmount: number;
    receivedAmount: number;
    diff: number;
  }>;
  missingIndexations: Array<{
    bienLabel: string;
    locataireName: string;
    anniversaryDate: Date;
    indexName: string;
    currentRent: number;
    theoreticalRent: number;
    diffPerMonth: number;
    diffCumulative: number;
  }>;
  charts: {
    // Données pour graphiques type "évolution des loyers toujours dus", etc.
    lateRentsCountByMonth: Array<{ month: string; count: number }>;
    lateRentsAmountByMonth: Array<{ month: string; amount: number }>;
    unmatchedAmountByMonth?: Array<{ month: string; amount: number }>;
  };
}

