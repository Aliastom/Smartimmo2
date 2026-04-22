/**
 * Utilitaire pour logger dans le terminal serveur depuis le client
 */

/**
 * Envoie un log au serveur pour affichage dans le terminal
 */
export async function logToServer(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  if (typeof window === 'undefined') {
    // Côté serveur, logger directement
    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '📝';
    console.log(`[${timestamp}] ${prefix} [APP-SHELL] ${message}`);
    return;
  }

  // Côté client : détecter si on est offline pour éviter les tentatives de POST inutiles
  const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
  
  // Si offline, logger directement dans la console (pas de POST)
  if (!isOnline) {
    const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '📝';
    console.log(`[APP-SHELL] ${prefix} ${message}`);
    return;
  }

  // Côté client online, envoyer au serveur
  try {
    await fetch('/api/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, level }),
    }).catch(() => {
      // En cas d'erreur réseau, logger dans la console du navigateur en fallback
      const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '📝';
      console.log(`[APP-SHELL] ${prefix} ${message}`);
    });
  } catch (error) {
    // Fallback vers console navigateur
    const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '📝';
    console.log(`[APP-SHELL] ${prefix} ${message}`);
  }
}

/** Logs réseau (/api/log) sur le CRUD transaction — désactivé par défaut. Activer : NEXT_PUBLIC_TX_DEBUG_LOGS=true */
export function isTransactionHotPathRemoteDebugEnabled(): boolean {
  return typeof process !== 'undefined' && process.env.NEXT_PUBLIC_TX_DEBUG_LOGS === 'true';
}

/** No-op sauf si NEXT_PUBLIC_TX_DEBUG_LOGS=true (évite tout POST de debug sur le chemin chaud). */
export async function txHotPathDebugLog(
  message: string,
  level: 'info' | 'warn' | 'error' = 'info'
): Promise<void> {
  if (!isTransactionHotPathRemoteDebugEnabled()) return;
  await logToServer(message, level);
}

let __txPerfSeq = 0;

/** Mesures Performance API pour le CRUD transaction. Activer : NEXT_PUBLIC_TX_PERF=true */
export function isTransactionPerfEnabled(): boolean {
  return typeof process !== 'undefined' && process.env.NEXT_PUBLIC_TX_PERF === 'true';
}

export function txPerfMark(name: string): void {
  if (!isTransactionPerfEnabled() || typeof performance === 'undefined') return;
  try {
    performance.mark(name);
  } catch {
    /* noop */
  }
}

/**
 * Démarre une mesure ; appeler la fonction retournée à la fin de la zone (try/finally).
 * Le nom apparaît dans performance.getEntriesByType('measure') sous measureName.
 */
export function txPerfMeasureZone(measureName: string): () => void {
  if (!isTransactionPerfEnabled() || typeof performance === 'undefined') {
    return () => {};
  }
  const id = `${++__txPerfSeq}`;
  const start = `tx:${measureName}:start:${id}`;
  const end = `tx:${measureName}:end:${id}`;
  try {
    performance.mark(start);
  } catch {
    return () => {};
  }
  return () => {
    try {
      performance.mark(end);
      performance.measure(measureName, start, end);
    } catch {
      /* noop */
    }
    try {
      performance.clearMarks(start);
      performance.clearMarks(end);
    } catch {
      /* noop */
    }
  };
}

/**
 * Fonction de debug (pour compatibilité avec l'ancien code)
 * TODO: À supprimer une fois le companion complètement retiré
 */
export function logDebug(message: string) {
  if (typeof window === 'undefined') {
    // Côté serveur, logger directement
    console.log(`[DEBUG] ${message}`);
  } else {
    // Côté client, utiliser logToServer
    logToServer(`[DEBUG] ${message}`, 'info');
  }
}

/**
 * Logger d'erreur unifié (compatibilité API)
 */
export function logError(message: string, error?: unknown) {
  const errorMessage = error instanceof Error ? error.message : error ? String(error) : '';
  const fullMessage = errorMessage ? `${message} - ${errorMessage}` : message;
  if (typeof window === 'undefined') {
    console.error(fullMessage);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    return;
  }
  logToServer(fullMessage, 'error');
}
