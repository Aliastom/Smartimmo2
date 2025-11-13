/**
 * Bibliothèque de calcul d'amortissement de prêts
 */

export interface AmortizationInput {
  principal: number;
  annualRatePct: number;
  durationMonths: number;
  defermentMonths?: number;
  insurancePct?: number;
  startDate: Date;
}

export interface ScheduleRow {
  month: number;
  date: string; // YYYY-MM
  paymentPrincipal: number;
  paymentInterest: number;
  paymentInsurance: number;
  paymentTotal: number;
  remainingCapital: number;
  cumulativeInterest: number;
  cumulativeInsurance: number;
}

/**
 * Construit le tableau d'amortissement complet
 */
export function buildSchedule(input: AmortizationInput): ScheduleRow[] {
  const {
    principal,
    annualRatePct,
    durationMonths,
    defermentMonths = 0,
    insurancePct = 0,
    startDate,
  } = input;

  const schedule: ScheduleRow[] = [];
  const monthlyRate = annualRatePct / 100 / 12;
  const monthlyInsuranceRate = insurancePct / 100 / 12;

  // Calculer la mensualité de principal + intérêts (hors assurance)
  let monthlyPaymentPrincipal = 0;
  if (monthlyRate > 0) {
    monthlyPaymentPrincipal =
      (principal * monthlyRate * Math.pow(1 + monthlyRate, durationMonths)) /
      (Math.pow(1 + monthlyRate, durationMonths) - 1);
  } else {
    monthlyPaymentPrincipal = principal / durationMonths;
  }

  let remainingCapital = principal;
  let cumulativeInterest = 0;
  let cumulativeInsurance = 0;

  for (let month = 1; month <= durationMonths; month++) {
    const currentDate = new Date(startDate);
    currentDate.setMonth(currentDate.getMonth() + month - 1);
    const dateStr = `${currentDate.getFullYear()}-${String(
      currentDate.getMonth() + 1
    ).padStart(2, '0')}`;

    let paymentPrincipal = 0;
    let paymentInterest = 0;

    if (month <= defermentMonths) {
      // Période de différé : on ne paie que les intérêts
      paymentInterest = remainingCapital * monthlyRate;
      paymentPrincipal = 0;
    } else {
      // Période d'amortissement normale
      paymentInterest = remainingCapital * monthlyRate;
      paymentPrincipal = monthlyPaymentPrincipal - paymentInterest;

      // Ajuster le dernier paiement pour solder exactement le capital
      if (remainingCapital - paymentPrincipal < 0.01) {
        paymentPrincipal = remainingCapital;
      }

      remainingCapital -= paymentPrincipal;
    }

    const paymentInsurance = principal * monthlyInsuranceRate;
    const paymentTotal = paymentPrincipal + paymentInterest + paymentInsurance;

    cumulativeInterest += paymentInterest;
    cumulativeInsurance += paymentInsurance;

    schedule.push({
      month,
      date: dateStr,
      paymentPrincipal: Math.round(paymentPrincipal * 100) / 100,
      paymentInterest: Math.round(paymentInterest * 100) / 100,
      paymentInsurance: Math.round(paymentInsurance * 100) / 100,
      paymentTotal: Math.round(paymentTotal * 100) / 100,
      remainingCapital: Math.max(0, Math.round(remainingCapital * 100) / 100),
      cumulativeInterest: Math.round(cumulativeInterest * 100) / 100,
      cumulativeInsurance: Math.round(cumulativeInsurance * 100) / 100,
    });
  }

  return schedule;
}

/**
 * Calcule le CRD (Capital Restant Dû) à un mois donné
 * @param schedule Le tableau d'amortissement
 * @param monthIndex L'index du mois (1-based)
 */
export function crdAt(schedule: ScheduleRow[], monthIndex: number): number {
  if (monthIndex <= 0) return schedule[0]?.remainingCapital || 0;
  if (monthIndex > schedule.length) return 0;
  return schedule[monthIndex - 1]?.remainingCapital || 0;
}

/**
 * Retourne une tranche du schedule entre deux mois (format YYYY-MM)
 * @param schedule Le tableau complet
 * @param from Date de début (YYYY-MM)
 * @param to Date de fin (YYYY-MM)
 */
export function sliceSchedule(
  schedule: ScheduleRow[],
  from?: string,
  to?: string
): ScheduleRow[] {
  if (!from && !to) return schedule;

  return schedule.filter((row) => {
    if (from && row.date < from) return false;
    if (to && row.date > to) return false;
    return true;
  });
}

/**
 * Calcule le CRD à une date donnée (YYYY-MM)
 */
export function crdAtDate(schedule: ScheduleRow[], date: string): number {
  // Trouver la ligne correspondant au mois ou le mois précédent
  const rows = schedule.filter((row) => row.date <= date);
  if (rows.length === 0) {
    // Avant le début du prêt
    return schedule[0]?.remainingCapital || 0;
  }
  return rows[rows.length - 1].remainingCapital;
}

/**
 * Calcule la mensualité totale (principal + intérêts + assurance)
 */
export function calculateMonthlyPayment(input: AmortizationInput): number {
  const {
    principal,
    annualRatePct,
    durationMonths,
    insurancePct = 0,
  } = input;

  const monthlyRate = annualRatePct / 100 / 12;
  const monthlyInsuranceRate = insurancePct / 100 / 12;

  let monthlyPaymentPrincipalInterest = 0;
  if (monthlyRate > 0) {
    monthlyPaymentPrincipalInterest =
      (principal * monthlyRate * Math.pow(1 + monthlyRate, durationMonths)) /
      (Math.pow(1 + monthlyRate, durationMonths) - 1);
  } else {
    monthlyPaymentPrincipalInterest = principal / durationMonths;
  }

  const monthlyInsurance = principal * monthlyInsuranceRate;
  return Math.round((monthlyPaymentPrincipalInterest + monthlyInsurance) * 100) / 100;
}

