/**
 * Calculs d'amortissement pour les prêts immobiliers
 */

export interface LoanAmortizationSchedule {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  remainingBalance: number;
}

export interface LoanCalculationResult {
  monthlyPayment: number;
  totalInterest: number;
  totalAmount: number;
  amortizationSchedule: LoanAmortizationSchedule[];
}

/**
 * Calcule la mensualité d'un prêt avec amortissement constant
 */
export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  months: number
): number {
  if (annualRate === 0) {
    return principal / months;
  }
  
  const monthlyRate = annualRate / 12;
  const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / 
    (Math.pow(1 + monthlyRate, months) - 1);
  
  return monthlyPayment;
}

/**
 * Calcule le capital restant dû après un certain nombre de mois
 */
export function calculateRemainingBalance(
  principal: number,
  annualRate: number,
  totalMonths: number,
  monthsPaid: number
): number {
  if (annualRate === 0) {
    return Math.max(0, principal - (principal / totalMonths) * monthsPaid);
  }
  
  const monthlyRate = annualRate / 12;
  const monthlyPayment = calculateMonthlyPayment(principal, annualRate, totalMonths);
  
  const remainingBalance = principal * Math.pow(1 + monthlyRate, monthsPaid) - 
    monthlyPayment * (Math.pow(1 + monthlyRate, monthsPaid) - 1) / monthlyRate;
  
  return Math.max(0, remainingBalance);
}

/**
 * Génère le tableau d'amortissement complet
 */
export function generateAmortizationSchedule(
  principal: number,
  annualRate: number,
  months: number
): LoanCalculationResult {
  const monthlyPayment = calculateMonthlyPayment(principal, annualRate, months);
  const monthlyRate = annualRate / 12;
  
  const schedule: LoanAmortizationSchedule[] = [];
  let remainingBalance = principal;
  let totalInterest = 0;
  
  for (let month = 1; month <= months; month++) {
    const interestPayment = remainingBalance * monthlyRate;
    const principalPayment = monthlyPayment - interestPayment;
    
    // Ajuster le dernier paiement si nécessaire
    const actualPrincipalPayment = Math.min(principalPayment, remainingBalance);
    const actualPayment = actualPrincipalPayment + interestPayment;
    
    remainingBalance = Math.max(0, remainingBalance - actualPrincipalPayment);
    totalInterest += interestPayment;
    
    schedule.push({
      month,
      payment: actualPayment,
      principal: actualPrincipalPayment,
      interest: interestPayment,
      remainingBalance,
    });
    
    if (remainingBalance <= 0) break;
  }
  
  return {
    monthlyPayment,
    totalInterest,
    totalAmount: principal + totalInterest,
    amortizationSchedule: schedule,
  };
}

/**
 * Calcule les statistiques d'un prêt
 */
export function calculateLoanStats(
  principal: number,
  annualRate: number,
  months: number,
  monthsPaid: number = 0
) {
  const calculation = generateAmortizationSchedule(principal, annualRate, months);
  const remainingBalance = calculateRemainingBalance(principal, annualRate, months, monthsPaid);
  const totalPaid = calculation.monthlyPayment * monthsPaid;
  const totalInterestPaid = totalPaid - (principal - remainingBalance);
  
  return {
    monthlyPayment: calculation.monthlyPayment,
    remainingBalance,
    totalPaid,
    totalInterestPaid,
    principalPaid: principal - remainingBalance,
    remainingMonths: months - monthsPaid,
  };
}
