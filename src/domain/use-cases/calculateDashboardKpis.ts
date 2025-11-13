import { Transaction } from '../entities/Transaction';
import { Loan } from '../entities/Loan';
import { Property } from '../entities/Property';

export interface DashboardKpis {
  rentsCollected: number;
  expenses: number;
  loanPayments: number;
  cashFlow: number;
  yield: number;
  missingRentAlert: boolean;
  monthlyData: Array<{
    month: string;
    loyers: number;
    charges: number;
    cashFlow: number;
  }>;
}

export interface CalculateDashboardKpisParams {
  properties: Property[];
  transactions: Transaction[];
  loans: Loan[];
}

export function calculateDashboardKpis(params: CalculateDashboardKpisParams): DashboardKpis {
  const { properties = [], transactions = [], loans = [] } = params;
  
  // Vérification supplémentaire pour s'assurer que les données sont des tableaux
  const safeProperties = Array.isArray(properties) ? properties : [];
  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  const safeLoans = Array.isArray(loans) ? loans : [];
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  
  // Calculer les 12 derniers mois
  const monthlyData = [];
  let totalRents = 0;
  let totalExpenses = 0;
  let totalLoanPayments = 0;
  let missingRentAlert = false;
  
  for (let i = 11; i >= 0; i--) {
    const monthDate = new Date(currentYear, currentMonth - i, 1);
    const monthString = monthDate.toISOString().substring(0, 7); // YYYY-MM
    const monthLabel = monthDate.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
    
    // Loyers du mois (revenus positifs)
    const monthRents = safeTransactions
      .filter(t => 
        t.amount > 0 && 
        new Date(t.date).toISOString().startsWith(monthString)
      )
      .reduce((sum, t) => sum + t.amount, 0);
    
    // Charges du mois (dépenses négatives)
    const monthExpenses = safeTransactions
      .filter(t => 
        t.amount < 0 && 
        new Date(t.date).toISOString().startsWith(monthString)
      )
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    // Mensualités de prêt du mois
    const monthLoanPayments = safeLoans
      .filter(loan => loan.status === 'active')
      .reduce((sum, loan) => sum + loan.monthlyPayment, 0);
    
    const monthCashFlow = monthRents - monthExpenses - monthLoanPayments;
    
    monthlyData.push({
      month: monthLabel,
      loyers: monthRents,
      charges: monthExpenses,
      cashFlow: monthCashFlow,
    });
    
    // Si c'est le mois actuel, ajouter aux totaux
    if (i === 0) {
      totalRents = monthRents;
      totalExpenses = monthExpenses;
      totalLoanPayments = monthLoanPayments;
      
      // Vérifier les loyers manquants pour le mois actuel
      const rentedProperties = safeProperties.filter(p => p.status === 'rented');
      const propertiesWithRent = new Set(
        safeTransactions
          .filter(t => 
            t.amount > 0 && 
            new Date(t.date).toISOString().startsWith(monthString)
          )
          .map(t => t.propertyId)
      );
      
      missingRentAlert = rentedProperties.some(p => !propertiesWithRent.has(p.id));
    }
  }
  
  const cashFlow = totalRents - totalExpenses - totalLoanPayments;
  
  // Calcul du rendement global
  const totalAcquisitionPrice = safeProperties.reduce(
    (sum, p) => sum + p.acquisitionPrice + p.notaryFees,
    0
  );
  
  const annualRents = totalRents * 12; // Approximation
  const yieldValue = totalAcquisitionPrice > 0 ? annualRents / totalAcquisitionPrice : 0;
  
  return {
    rentsCollected: totalRents,
    expenses: totalExpenses,
    loanPayments: totalLoanPayments,
    cashFlow,
    yield: yieldValue,
    missingRentAlert,
    monthlyData,
  };
}
