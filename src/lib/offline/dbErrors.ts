/**
 * Erreurs typées pour la gestion de la base de données locale
 * Permet de distinguer les erreurs DB_UNAVAILABLE des autres erreurs
 */

export class DbUnavailableError extends Error {
  constructor(message?: string) {
    super(message || 'La base de données locale n\'est pas accessible');
    this.name = 'DbUnavailableError';
  }
}

export function isDbUnavailableError(error: any): error is DbUnavailableError {
  return error instanceof DbUnavailableError || 
         error?.name === 'DbUnavailableError' ||
         error?.message?.includes('DB_UNAVAILABLE');
}

