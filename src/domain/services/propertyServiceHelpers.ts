/**
 * Helpers pour PropertyService (mapping erreurs, etc.)
 */

/**
 * Convertit une erreur PropertyService en status HTTP approprié
 */
export function mapPropertyServiceErrorToHttpStatus(error: Error): number {
  const message = error.message.toLowerCase();
  
  // Vérifier les erreurs de dépendances en premier (avant "requis" qui pourrait être trop générique)
  if (message.includes('des éléments sont liés') || message.includes('dépendances') || message.includes('dependencies')) {
    return 409; // Conflict
  }
  
  if (message.includes('requis') || message.includes('requise') || message.includes('invalide') || message.includes('invalid')) {
    return 400; // Bad Request
  }
  
  if (message.includes('introuvable') || message.includes('non trouvé') || message.includes('not found')) {
    return 404; // Not Found
  }
  
  if (message.includes('non autorisé') || message.includes('forbidden') || message.includes('unauthorized')) {
    return 403; // Forbidden
  }
  
  if (message.includes('bien cible') || message.includes('target property')) {
    return 400; // Bad Request
  }
  
  return 500; // Internal Server Error
}

