import { buildSchedule, crdAtDate, type ScheduleRow } from '@/lib/finance/amortization';

export type LoanBusinessStatus = 'actif' | 'solde' | 'inactif';

export interface LoanLike {
  id: string;
  propertyId: string;
  label: string;
  principal: number;
  annualRatePct: number;
  durationMonths: number;
  defermentMonths?: number | null;
  insurancePct?: number | null;
  feesUpfront?: number | null;
  startDate: string;
  paymentDay?: number | null;
  isActive?: boolean;
  status?: string | null;
}

export interface LoanMetrics {
  schedule: ScheduleRow[];
  monthlyPayment: number;
  currentCRD: number;
  endDateIso: string | null;
  totalCost: number;
  remainingInterests: number;
  repaidPercent: number;
  remainingMonths: number;
}

export interface LoanDisplayInfo extends LoanMetrics {
  status: LoanBusinessStatus;
  propertyName: string;
}

function toMonthKey(dateValue: Date): string {
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function computeLoanMetrics(loan: LoanLike, now: Date = new Date()): LoanMetrics {
  const principal = Number(loan.principal || 0);
  const durationMonths = Number(loan.durationMonths || 0);

  if (principal <= 0 || durationMonths <= 0 || !loan.startDate) {
    return {
      schedule: [],
      monthlyPayment: 0,
      currentCRD: 0,
      endDateIso: null,
      totalCost: 0,
      remainingInterests: 0,
      repaidPercent: 0,
      remainingMonths: 0,
    };
  }

  const schedule = buildSchedule({
    principal,
    annualRatePct: Number(loan.annualRatePct || 0),
    durationMonths,
    defermentMonths: Number(loan.defermentMonths || 0),
    insurancePct: Number(loan.insurancePct || 0),
    startDate: new Date(loan.startDate),
    paymentDay: loan.paymentDay ?? undefined,
  });

  const defermentMonths = Number(loan.defermentMonths || 0);
  const paymentRow = schedule.find((row) => row.month > defermentMonths) || schedule[0];
  const monthlyPayment = paymentRow?.paymentTotal || 0;

  const nowMonthKey = toMonthKey(now);
  const startDate = new Date(loan.startDate);
  const startMonthKey = toMonthKey(startDate);

  let currentCRD = principal;
  if (schedule.length > 0) {
    if (nowMonthKey >= startMonthKey) {
      currentCRD = crdAtDate(schedule, nowMonthKey);
    }
    const lastRow = schedule[schedule.length - 1];
    const lastMonthKey = lastRow.date.substring(0, 7);
    if (nowMonthKey > lastMonthKey) {
      currentCRD = 0;
    }
  }

  const endDateIso = schedule.length > 0 ? schedule[schedule.length - 1].date : null;
  const totalInterests = schedule.reduce((sum, row) => sum + row.paymentInterest, 0);
  const totalInsurance = schedule.reduce((sum, row) => sum + row.paymentInsurance, 0);
  const feesUpfront = Number(loan.feesUpfront || 0);
  const totalCost = principal + totalInterests + totalInsurance + feesUpfront;

  const paidInterests = schedule
    .filter((row) => row.date.substring(0, 7) <= nowMonthKey)
    .reduce((sum, row) => sum + row.paymentInterest, 0);
  const remainingInterests = Math.max(0, totalInterests - paidInterests);

  const repaidPercent = principal > 0
    ? Math.min(100, Math.max(0, ((principal - currentCRD) / principal) * 100))
    : 0;

  const remainingMonths = schedule.filter((row) => row.date.substring(0, 7) > nowMonthKey).length;

  return {
    schedule,
    monthlyPayment,
    currentCRD,
    endDateIso,
    totalCost,
    remainingInterests,
    repaidPercent,
    remainingMonths,
  };
}

export function computeLoanBusinessStatus(
  loan: LoanLike,
  metrics: LoanMetrics,
  _now: Date = new Date(),
): LoanBusinessStatus {
  const rawStatus = (loan.status || '').toString().trim().toLowerCase();
  if (rawStatus === 'solde' || rawStatus === 'paid' || rawStatus === 'closed') {
    return 'solde';
  }
  if (rawStatus === 'inactif' || rawStatus === 'inactive' || rawStatus === 'archive' || rawStatus === 'archived') {
    return 'inactif';
  }
  if (rawStatus === 'actif' || rawStatus === 'active') {
    return 'actif';
  }

  const hasValidStartDate = Boolean(loan.startDate) && !Number.isNaN(new Date(loan.startDate).getTime());
  const hasValidPrincipal = Number(loan.principal || 0) > 0;
  const hasValidDuration = Number(loan.durationMonths || 0) > 0;
  const isIncompleteLoan = !hasValidStartDate || !hasValidPrincipal || !hasValidDuration;

  // Fallback produit : un prêt incomplet n'est jamais considéré "soldé".
  if (isIncompleteLoan) {
    return 'inactif';
  }

  // Compatibilite temporaire avec l'existant (isActive + calcul CRD)
  if (metrics.currentCRD <= 0.01) {
    return 'solde';
  }
  if (loan.isActive === false) {
    return 'inactif';
  }
  return 'actif';
}

export function getLoanDisplayInfo(
  loan: LoanLike,
  propertyName: string,
  now: Date = new Date(),
): LoanDisplayInfo {
  const metrics = computeLoanMetrics(loan, now);
  const status = computeLoanBusinessStatus(loan, metrics, now);

  return {
    ...metrics,
    status,
    propertyName,
  };
}

