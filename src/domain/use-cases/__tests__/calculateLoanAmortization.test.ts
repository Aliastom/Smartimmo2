import { calculateLoanAmortization } from '../calculateLoanAmortization';

describe('calculateLoanAmortization', () => {
  it('should calculate monthly payment correctly', () => {
    const result = calculateLoanAmortization({
      loanAmount: 200000,
      interestRate: 0.03, // 3%
      insuranceRate: 0.003, // 0.3%
      durationMonths: 240, // 20 years
      startDate: new Date('2024-01-01'),
    });

    expect(result.monthlyPayment).toBeGreaterThan(0);
    expect(result.remainingCapital).toBeGreaterThan(0);
    expect(result.remainingCapital).toBeLessThanOrEqual(200000);
  });

  it('should handle zero interest rate', () => {
    const result = calculateLoanAmortization({
      loanAmount: 200000,
      interestRate: 0,
      insuranceRate: 0.003,
      durationMonths: 240,
      startDate: new Date('2024-01-01'),
    });

    expect(result.monthlyPayment).toBeGreaterThan(0);
    expect(result.remainingCapital).toBeGreaterThan(0);
  });

  it('should calculate remaining capital based on time passed', () => {
    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - 1); // 1 year ago

    const result = calculateLoanAmortization({
      loanAmount: 200000,
      interestRate: 0.03,
      insuranceRate: 0.003,
      durationMonths: 240,
      startDate: pastDate,
    });

    expect(result.remainingCapital).toBeLessThan(200000);
  });
});
