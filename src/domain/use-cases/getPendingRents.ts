import { Property } from '../entities/Property';
import { Transaction } from '../entities/Transaction';
import { Lease } from '../entities/Lease';
import { Category } from '../entities/Category';

export interface PendingRent {
  propertyId: string;
  name: string;
  expected: number;
}

export function getPendingRents(
  year: number,
  month: number,
  properties: Property[],
  transactions: Transaction[],
  leases: Lease[],
  categories: Category[]
): PendingRent[] {
  // Trouver la catégorie "Loyer"
  const loyerCategory = categories.find(c => c.name === 'Loyer' && c.type === 'revenu');
  if (!loyerCategory) return [];

  // Trouver les baux actifs pour le mois donné
  const activeLeases = leases.filter(lease => {
    const startDate = new Date(lease.startDate);
    const endDate = lease.endDate ? new Date(lease.endDate) : null;
    const targetDate = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0); // Dernier jour du mois
    
    return lease.status === 'active' && 
           startDate <= endOfMonth && 
           (!endDate || endDate >= targetDate);
  });

  // Trouver les transactions de loyer pour le mois donné
  const rentTransactions = transactions.filter(transaction => {
    const transactionDate = new Date(transaction.date);
    return transaction.categoryId === loyerCategory.id &&
           transactionDate.getFullYear() === year &&
           transactionDate.getMonth() + 1 === month;
  });

  const paidPropertyIds = new Set(rentTransactions.map(t => t.propertyId));

  // Retourner les biens avec baux actifs mais sans loyer payé
  return activeLeases
    .filter(lease => !paidPropertyIds.has(lease.propertyId))
    .map(lease => {
      const property = properties.find(p => p.id === lease.propertyId);
      return {
        propertyId: lease.propertyId,
        name: property?.name || 'Bien inconnu',
        expected: lease.rentAmount
      };
    });
}
