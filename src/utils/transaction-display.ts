/**
 * Utilitaire pour afficher les transactions avec couleurs et signes corrects
 */

import { formatCurrencyEUR } from './format';

export type TransactionDisplayData = {
  color: string;
  sign: string;
  amount: string;
  rawAmount: number;
};

/**
 * Détermine l'affichage d'une transaction basé sur sa nature
 * LOYER, CAUTION, etc. = REVENU = vert avec "+"
 * CHARGES, TRAVAUX, etc. = DÉPENSE = rouge avec "-"
 */
export function getTransactionDisplay(transaction: {
  amount: number;
  nature?: string;
  accountingCategory?: { type: 'REVENU' | 'DEPENSE' } | null;
}): TransactionDisplayData {
  // Déterminer si c'est un revenu basé sur nature ou catégorie
  const isRevenue = 
    transaction.nature === 'LOYER' ||
    transaction.nature === 'CAUTION' ||
    transaction.nature === 'DEPOT_GARANTIE' ||
    transaction.accountingCategory?.type === 'REVENU';

  const absoluteAmount = Math.abs(transaction.amount);
  
  return {
    color: isRevenue ? 'text-success' : 'text-error',
    sign: isRevenue ? '+' : '-',
    amount: formatCurrencyEUR(absoluteAmount),
    rawAmount: absoluteAmount,
  };
}

/**
 * Classe Tailwind pour bg selon type de transaction
 */
export function getTransactionBgClass(transaction: {
  nature?: string;
  accountingCategory?: { type: 'REVENU' | 'DEPENSE' } | null;
}): string {
  const isRevenue = 
    transaction.nature === 'LOYER' ||
    transaction.nature === 'CAUTION' ||
    transaction.nature === 'DEPOT_GARANTIE' ||
    transaction.accountingCategory?.type === 'REVENU';
  
  return isRevenue ? 'bg-green-50' : 'bg-red-50';
}

/**
 * Badge couleur pour la nature
 */
export function getTransactionBadgeClass(transaction: {
  nature?: string;
  accountingCategory?: { type: 'REVENU' | 'DEPENSE' } | null;
}): string {
  const isRevenue = 
    transaction.nature === 'LOYER' ||
    transaction.nature === 'CAUTION' ||
    transaction.nature === 'DEPOT_GARANTIE' ||
    transaction.accountingCategory?.type === 'REVENU';
  
  return isRevenue 
    ? 'bg-green-100 text-green-800' 
    : 'bg-red-100 text-red-800';
}

