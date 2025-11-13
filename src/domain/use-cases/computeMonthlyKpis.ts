import { Property } from '../entities/Property';
import { Transaction } from '../entities/Transaction';
import { Loan } from '../entities/Loan';

export interface MonthlyKpis {
  month: string;
  rentsCollected: number;
  expenses: number;
  loanPayments: number;
  cashFlow: number;
  yield: number;
  missingRentAlert: boolean;
}

export interface ComputeMonthlyKpisParams {
  properties: Property[];
  transactions: Transaction[];
  loans: Loan[];
  currentMonth: Date;
}

export const computeMonthlyKpis = (params: ComputeMonthlyKpisParams): MonthlyKpis => {
  const { properties, transactions, loans, currentMonth } = params;

  let rentsCollected = 0;
  let expenses = 0;
  let loanPayments = 0;
  let missingRentAlert = false;

  const currentMonthString = currentMonth.toISOString().substring(0, 7); // YYYY-MM

  // Calculate rents and check for missing rents
  for (const property of properties) {
    // For simplicity, assume a fixed rent for now, or fetch from active lease
    // In a real app, this would involve checking active leases and their payments
    const propertyRents = transactions.filter(
      (t) =>
        t.propertyId === property.id &&
        t.amount > 0 &&
        t.date.toISOString().startsWith(currentMonthString),
    );

    if (property.status === 'rented' && propertyRents.length === 0) {
      missingRentAlert = true;
    }

    rentsCollected += propertyRents.reduce((sum, t) => sum + t.amount, 0);
  }

  // Calculate expenses (dépenses négatives)
  expenses = transactions
    .filter(
      (t) =>
        t.amount < 0 && t.date.toISOString().startsWith(currentMonthString),
    )
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Calculate loan payments
  loanPayments = loans
    .filter((loan) => loan.startDate <= currentMonth && loan.status === 'active')
    .reduce((sum, loan) => sum + loan.monthlyPayment, 0);

  const cashFlow = rentsCollected - expenses - loanPayments;

  // Simple yield calculation (needs more sophisticated logic in real app)
  const totalAcquisitionPrice = properties.reduce(
    (sum, p) => sum + p.acquisitionPrice + p.notaryFees,
    0,
  );
  const yieldValue =
    totalAcquisitionPrice > 0
      ? (rentsCollected * 12) / totalAcquisitionPrice
      : 0;

  return {
    month: currentMonthString,
    rentsCollected,
    expenses,
    loanPayments,
    cashFlow,
    yield: yieldValue,
    missingRentAlert,
  };
};
