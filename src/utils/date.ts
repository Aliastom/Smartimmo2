/**
 * Utilitaires de gestion des dates avec support des fuseaux horaires
 * Utilise la timezone Europe/Paris pour l'application
 */

export const APP_TIMEZONE = 'Europe/Paris';

/**
 * Convertit une date en date locale (Europe/Paris) au format YYYY-MM-DD
 */
export function toLocalDate(date: Date | string, timezone: string = APP_TIMEZONE): string {
  const d = new Date(date);
  return d.toLocaleDateString('sv-SE', { timeZone: timezone }); // sv-SE = YYYY-MM-DD
}

/**
 * Vérifie si une date est entre deux dates (bornes inclusives)
 * Compare uniquement les dates (sans heures) en timezone locale
 */
export function isBetweenInclusive(
  date: Date | string,
  startDate: Date | string,
  endDate: Date | string,
  timezone: string = APP_TIMEZONE
): boolean {
  const localDate = toLocalDate(date, timezone);
  const localStart = toLocalDate(startDate, timezone);
  const localEnd = toLocalDate(endDate, timezone);
  
  return localDate >= localStart && localDate <= localEnd;
}

/**
 * Retourne la date d'aujourd'hui en timezone locale
 */
export function getToday(timezone: string = APP_TIMEZONE): string {
  return toLocalDate(new Date(), timezone);
}

/**
 * Compare deux dates (sans heures) en timezone locale
 * Retourne -1 si date1 < date2, 0 si égales, 1 si date1 > date2
 */
export function compareDates(
  date1: Date | string,
  date2: Date | string,
  timezone: string = APP_TIMEZONE
): number {
  const local1 = toLocalDate(date1, timezone);
  const local2 = toLocalDate(date2, timezone);
  
  if (local1 < local2) return -1;
  if (local1 > local2) return 1;
  return 0;
}
