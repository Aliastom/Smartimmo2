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
