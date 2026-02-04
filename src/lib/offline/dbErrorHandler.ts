/**
 * Utilitaire pour gérer les erreurs DB_UNAVAILABLE de manière cohérente
 * Émet un événement pour que l'app affiche l'écran de recovery
 */

import { DbUnavailableError, isDbUnavailableError } from './dbErrors';

/**
 * Gère une erreur DB_UNAVAILABLE en émettant un événement
 * @param error - L'erreur à gérer
 * @param context - Contexte pour les logs (ex: 'useDashboardData')
 */
export function handleDbUnavailableError(error: any, context?: string): void {
  if (isDbUnavailableError(error)) {
    const contextPrefix = context ? `[${context}]` : '';
    console.error(`${contextPrefix} ❌ DB_UNAVAILABLE détectée`);
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('localdb:unavailable', {
        detail: { error }
      }));
    }
  }
}

/**
 * Vérifie si getLocalDB() retourne null et throw DbUnavailableError si c'est le cas
 * @param db - Résultat de getLocalDB()
 * @throws DbUnavailableError si db est null
 */
export async function ensureDbAvailable(db: any): Promise<void> {
  if (!db) {
    throw new DbUnavailableError('La base de données locale n\'est pas accessible');
  }
}

