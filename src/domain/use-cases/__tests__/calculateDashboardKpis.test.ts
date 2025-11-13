import { calculateDashboardKpis } from '../calculateDashboardKpis';
import { Property } from '../../entities/Property';
import { Transaction } from '../../entities/Transaction';
import { Loan } from '../../entities/Loan';

describe('calculateDashboardKpis', () => {
  const mockProperties: Property[] = [
    {
      id: '1',
      name: 'Test Property',
      type: 'apartment',
      address: '123 Test St',
      postalCode: '75001',
      city: 'Paris',
      surface: 50,
      rooms: 2,
      acquisitionDate: new Date('2020-01-01'),
      acquisitionPrice: 200000,
      notaryFees: 15000,
      currentValue: 220000,
      status: 'rented',
      notes: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockTransactions: Transaction[] = [
    {
      id: '1',
      propertyId: '1',
      type: 'rent',
      label: 'Loyer janvier',
      amount: 1000,
      date: new Date('2024-01-01'),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '2',
      propertyId: '1',
      type: 'expense',
      label: 'Charges',
      amount: 200,
      date: new Date('2024-01-01'),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockLoans: Loan[] = [
    {
      id: '1',
      propertyId: '1',
      bankName: 'Test Bank',
      loanAmount: 150000,
      interestRate: 0.03,
      insuranceRate: 0.003,
      durationMonths: 240,
      startDate: new Date('2020-01-01'),
      monthlyPayment: 800,
      remainingCapital: 120000,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  it('should calculate KPIs correctly', () => {
    const result = calculateDashboardKpis({
      properties: mockProperties,
      transactions: mockTransactions,
      loans: mockLoans,
    });

    expect(result.rentsCollected).toBe(1000);
    expect(result.expenses).toBe(200);
    expect(result.cashFlow).toBe(0); // 1000 - 200 - 800
    expect(result.yield).toBeGreaterThan(0);
    expect(result.monthlyData).toBeDefined();
    expect(result.missingRentAlert).toBeDefined();
  });

  it('should handle empty data', () => {
    const result = calculateDashboardKpis({
      properties: [],
      transactions: [],
      loans: [],
    });

    expect(result.rentsCollected).toBe(0);
    expect(result.expenses).toBe(0);
    expect(result.cashFlow).toBe(0);
    expect(result.yield).toBe(0);
    expect(result.monthlyData).toEqual([]);
    expect(result.missingRentAlert).toBeNull();
  });

  it('should detect missing rent alerts', () => {
    const propertiesWithoutRent: Property[] = [
      {
        ...mockProperties[0],
        status: 'rented',
      },
    ];

    const transactionsWithoutRent: Transaction[] = [
      {
        id: '2',
        propertyId: '1',
        type: 'expense',
        label: 'Charges',
        amount: 200,
        date: new Date('2024-01-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = calculateDashboardKpis({
      properties: propertiesWithoutRent,
      transactions: transactionsWithoutRent,
      loans: mockLoans,
    });

    expect(result.missingRentAlert).toBeDefined();
    expect(result.missingRentAlert).toContain('Loyer manquant');
  });
});
