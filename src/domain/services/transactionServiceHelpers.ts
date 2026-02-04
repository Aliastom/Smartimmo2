/**
 * Helpers pour TransactionService (récupération settings, mapping, etc.)
 */

import { isGestionDelegueEnabled, getGestionCodes } from '@/lib/settings/appSettings';

/**
 * Récupère les settings de gestion déléguée pour TransactionService
 */
export async function getGestionSettings() {
  const gestionEnabled = await isGestionDelegueEnabled();
  const codes = await getGestionCodes();
  
  return {
    gestionEnabled,
    gestionCodes: {
      rentNature: codes.rentNature,
      mgmtNature: codes.mgmtNature,
      mgmtCategory: codes.mgmtCategory,
    },
  };
}

/**
 * Convertit une erreur TransactionService en status HTTP approprié
 */
export function mapTransactionServiceErrorToHttpStatus(error: Error): number {
  const message = error.message.toLowerCase();
  
  if (message.includes('requis') || message.includes('requise') || message.includes('invalide')) {
    return 400; // Bad Request
  }
  
  if (message.includes('introuvable') || message.includes('non trouvée') || message.includes('not found')) {
    return 404; // Not Found
  }
  
  if (message.includes('non autorisé') || message.includes('forbidden') || message.includes('unauthorized')) {
    return 403; // Forbidden
  }
  
  if (message.includes('doublon') || message.includes('duplicate')) {
    return 409; // Conflict
  }
  
  return 500; // Internal Server Error
}
