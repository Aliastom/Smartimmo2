/** Tooltip pour la colonne « Poids dans cashflow ». */
export const LOAN_CASHFLOW_WEIGHT_TOOLTIP =
  'Part de la mensualité dans le cashflow brut du bien';

export { LoanCashflowWeightProgressBar } from './LoanCashflowWeightProgressBar';

/**
 * Poids = mensualité / cashflow brut moyen du bien (12 mois), en %.
 * Retourne null si le dénominateur n’est pas utilisable (≤ 0).
 */
export function computeLoanWeightInCashflowPct(
  monthlyPayment: number,
  propertyCashflowMonthly: number,
): number | null {
  if (!(propertyCashflowMonthly > 0)) return null;
  return (monthlyPayment / propertyCashflowMonthly) * 100;
}

export type LoanCashflowWeightLevel = 'none' | 'sain' | 'tendu' | 'insoutenable';

export interface LoanCashflowWeightDisplay {
  level: LoanCashflowWeightLevel;
  /** Texte complet affiché dans le badge, ex. "45 % (sain)" */
  text: string;
  showWarningIcon: boolean;
  badgeClassName: string;
}

/**
 * Libellé + style pour lecture immédiate du risque (seuils 80 % / 100 %).
 */
export function getLoanCashflowWeightDisplay(pct: number | null): LoanCashflowWeightDisplay {
  if (pct === null) {
    return {
      level: 'none',
      text: '—',
      showWarningIcon: false,
      badgeClassName: 'border-gray-200 bg-gray-50 text-gray-500',
    };
  }
  const rounded = Math.round(pct);
  if (pct > 100) {
    return {
      level: 'insoutenable',
      text: `${rounded} % (insoutenable)`,
      showWarningIcon: true,
      badgeClassName: 'border-red-400 bg-red-100 text-red-900',
    };
  }
  if (pct >= 80) {
    return {
      level: 'tendu',
      text: `${rounded} % (tendu)`,
      showWarningIcon: false,
      badgeClassName: 'border-amber-400 bg-amber-100 text-amber-950',
    };
  }
  return {
    level: 'sain',
    text: `${rounded} % (sain)`,
    showWarningIcon: false,
    badgeClassName: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  };
}

/** @deprecated Utiliser getLoanCashflowWeightDisplay pour l’UI tableau. */
export function formatLoanCashflowWeightLabel(pct: number | null): string {
  if (pct === null) return '—';
  return `${Math.round(pct)} %`;
}

/** @deprecated Utiliser getLoanCashflowWeightDisplay pour l’UI tableau. */
export function loanCashflowWeightTextClass(pct: number | null): string {
  if (pct === null) return 'text-gray-500';
  if (pct < 50) return 'text-emerald-600';
  if (pct <= 80) return 'text-amber-600';
  return 'text-red-600';
}
