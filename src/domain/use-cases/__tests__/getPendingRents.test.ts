import { getPendingRents } from '../getPendingRents';
import { Property } from '../../entities/Property';
import { Transaction } from '../../entities/Transaction';
import { Lease } from '../../entities/Lease';
import { Category } from '../../entities/Category';

describe('getPendingRents', () => {
  const mockProperties: Property[] = [
    {
      id: 'property1',
      name: 'Appartement A',
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
    {
      id: 'property2',
      name: 'Appartement B',
      type: 'apartment',
      address: '456 Test Ave',
      postalCode: '75002',
      city: 'Paris',
      surface: 60,
      rooms: 3,
      acquisitionDate: new Date('2021-01-01'),
      acquisitionPrice: 250000,
      notaryFees: 18000,
      currentValue: 270000,
      status: 'rented',
      notes: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockCategories: Category[] = [
    {
      id: 'category1',
      name: 'Loyer',
      type: 'revenu',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockLeases: Lease[] = [
    {
      id: 'lease1',
      propertyId: 'property1',
      tenantId: 'tenant1',
      leaseType: 'empty',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      rentAmount: 1000,
      chargesAmount: 100,
      depositAmount: 2000,
      indexationType: 'irl',
      paymentDay: 1,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'lease2',
      propertyId: 'property2',
      tenantId: 'tenant2',
      leaseType: 'empty',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      rentAmount: 1200,
      chargesAmount: 120,
      depositAmount: 2400,
      indexationType: 'irl',
      paymentDay: 1,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  it('should return empty array when no loyer category exists', () => {
    const result = getPendingRents(2024, 1, mockProperties, [], mockLeases, []);
    expect(result).toEqual([]);
  });

  it('should return properties with active leases but no rent paid for the month', () => {
    const mockTransactions: Transaction[] = [
      {
        id: 'transaction1',
        propertyId: 'property1',
        categoryId: 'category1',
        label: 'Loyer janvier',
        amount: 1100,
        date: new Date('2024-01-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      // Pas de transaction pour property2
    ];

    const result = getPendingRents(2024, 1, mockProperties, mockTransactions, mockLeases, mockCategories);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      propertyId: 'property2',
      name: 'Appartement B',
      expected: 1200,
    });
  });

  it('should return all properties when no rents are paid', () => {
    const result = getPendingRents(2024, 1, mockProperties, [], mockLeases, mockCategories);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      propertyId: 'property1',
      name: 'Appartement A',
      expected: 1000,
    });
    expect(result[1]).toEqual({
      propertyId: 'property2',
      name: 'Appartement B',
      expected: 1200,
    });
  });

  it('should return empty array when all rents are paid', () => {
    const mockTransactions: Transaction[] = [
      {
        id: 'transaction1',
        propertyId: 'property1',
        categoryId: 'category1',
        label: 'Loyer janvier',
        amount: 1100,
        date: new Date('2024-01-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'transaction2',
        propertyId: 'property2',
        categoryId: 'category1',
        label: 'Loyer janvier',
        amount: 1320,
        date: new Date('2024-01-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = getPendingRents(2024, 1, mockProperties, mockTransactions, mockLeases, mockCategories);

    expect(result).toHaveLength(0);
  });

  it('should handle leases that are not active for the given month', () => {
    const inactiveLeases: Lease[] = [
      {
        ...mockLeases[0],
        status: 'terminated',
      },
      {
        ...mockLeases[1],
        endDate: new Date('2023-12-31'), // Terminé avant janvier 2024
      },
    ];

    const result = getPendingRents(2024, 1, mockProperties, [], inactiveLeases, mockCategories);

    expect(result).toHaveLength(0);
  });
});
