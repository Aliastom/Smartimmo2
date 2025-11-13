/**
 * Calcule le statut de paiement pour un bail et une période donnée
 */
export const calculatePaymentStatus = (
  expected: number,
  received: number
): 'PAID' | 'PARTIAL' | 'UNPAID' => {
  if (received >= expected) return 'PAID';
  if (received > 0) return 'PARTIAL';
  return 'UNPAID';
};

/**
 * Retourne le badge CSS selon le statut
 */
export const getPaymentBadgeClasses = (status: 'PAID' | 'PARTIAL' | 'UNPAID') => {
  switch (status) {
    case 'PAID':
      return 'bg-green-100 text-green-800';
    case 'PARTIAL':
      return 'bg-orange-100 text-orange-800';
    case 'UNPAID':
      return 'bg-red-100 text-red-800';
  }
};

/**
 * Retourne le label selon le statut
 */
export const getPaymentStatusLabel = (status: 'PAID' | 'PARTIAL' | 'UNPAID') => {
  switch (status) {
    case 'PAID':
      return 'Payé';
    case 'PARTIAL':
      return 'Partiel';
    case 'UNPAID':
      return 'Impayé';
  }
};

