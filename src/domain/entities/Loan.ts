export interface Loan {
  id: string;
  propertyId: string;
  bankName: string;
  loanAmount: number; // Decimal
  interestRate: number; // Decimal
  insuranceRate: number; // Decimal
  durationMonths: number;
  startDate: Date;
  monthlyPayment: number; // Decimal
  remainingCapital: number; // Decimal
  status: 'active' | 'paid_off' | 'refinanced';
  createdAt: Date;
  updatedAt: Date;
}
