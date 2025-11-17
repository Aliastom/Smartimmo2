/**
 * Logger utilitaire pour le développement et la production
 * Permet de contrôler les logs via variable d'environnement
 */

const DEBUG_ENABLED = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG === 'true';

/**
 * Log de débogage (uniquement en développement ou si NEXT_PUBLIC_DEBUG=true)
 */
export function logDebug(...args: unknown[]): void {
  if (DEBUG_ENABLED) {
    console.log(...args);
  }
}

/**
 * Log d'information (toujours activé)
 */
export function logInfo(...args: unknown[]): void {
  console.info(...args);
}

/**
 * Log d'erreur (toujours activé)
 */
export function logError(...args: unknown[]): void {
  console.error(...args);
}

/**
 * Log d'avertissement (toujours activé)
 */
export function logWarn(...args: unknown[]): void {
  console.warn(...args);
}

