/**
 * Helpers pour LeaseService (mapping erreurs, etc.)
 */

/**
 * Convertit une erreur LeaseService en status HTTP approprié
 */
export function mapLeaseServiceErrorToHttpStatus(error: Error): number {
  const message = error.message.toLowerCase();
  
  if (message.includes('requis') || message.includes('requise') || message.includes('invalide') || message.includes('invalid')) {
    return 400; // Bad Request
  }
  
  if (message.includes('introuvable') || message.includes('non trouvé') || message.includes('not found')) {
    return 404; // Not Found
  }
  
  if (message.includes('non autorisé') || message.includes('forbidden') || message.includes('unauthorized')) {
    return 403; // Forbidden
  }
  
  if (message.includes('chevauchement') || message.includes('overlap') || message.includes('existe sur cette période')) {
    return 400; // Bad Request (conflit de dates)
  }
  
  if (message.includes('actif') && message.includes('supprimer')) {
    return 409; // Conflict (bail actif ne peut pas être supprimé)
  }
  
  if (message.includes('transactions') && message.includes('supprimer')) {
    return 409; // Conflict (bail avec transactions ne peut pas être supprimé)
  }
  
  if (message.includes('dépôt') || message.includes('deposit') || message.includes('plafond')) {
    return 400; // Bad Request (dépôt invalide)
  }
  
  return 500; // Internal Server Error
}

