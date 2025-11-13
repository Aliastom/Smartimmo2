/**
 * Utilitaires de formatage pour l'application Smartimmo
 */

/**
 * Formate un nombre en devise EUR
 */
export function formatCurrencyEUR(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formate une date en format français
 */
export function formatDateFR(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(dateObj);
}

/**
 * Formate une date courte (JJ/MM/AAAA)
 */
export function formatDateShort(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dateObj);
}

/**
 * Formate un pourcentage
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
}

/**
 * Formate un nombre avec séparateurs de milliers
 */
export function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Formate une taille de fichier en bytes
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Formate un mois et une année (ex: "Octobre 2025")
 */
export function formatMonthYearFR(year: number, month1to12: number): string {
  const date = new Date(year, month1to12 - 1, 1);
  return date.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Parse un montant français (virgule comme séparateur décimal) en nombre
 */
export function parseAmountFrToNumber(amount: string | number): number {
  if (typeof amount === 'number') return amount;
  
  // Remplacer espaces fines et virgules, puis parser
  const cleanAmount = String(amount)
    .replace(/[\u00A0\s]/g, '') // Espaces fines et normales
    .replace(',', '.'); // Virgule -> point
  
  const parsed = parseFloat(cleanAmount);
  if (isNaN(parsed)) {
    throw new Error(`Montant invalide: ${amount}`);
  }
  
  return parsed;
}
