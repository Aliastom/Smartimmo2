/**
 * Safeguard DEV pour détecter les remount loops
 * Désactivé en production
 */

const mountHistory: Array<{ component: string; timestamp: number }> = [];
const MAX_MOUNTS = 10;
const TIME_WINDOW_MS = 5000; // 5 secondes

/**
 * Enregistre un mount et détecte les loops
 * @param componentName Nom du composant (pour le log)
 */
export function trackMount(componentName: string) {
  if (process.env.NODE_ENV !== 'development') {
    return; // No-op en production
  }

  const now = Date.now();
  
  // Nettoyer les mounts anciens (hors de la fenêtre de temps)
  while (mountHistory.length > 0 && now - mountHistory[0].timestamp > TIME_WINDOW_MS) {
    mountHistory.shift();
  }
  
  // Ajouter le nouveau mount
  mountHistory.push({ component: componentName, timestamp: now });
  
  // Détecter un loop si trop de mounts dans la fenêtre
  if (mountHistory.length >= MAX_MOUNTS) {
    console.warn(
      `[DEV SAFEGUARD] ⚠️ Remount loop détecté pour "${componentName}":`,
      `${mountHistory.length} mounts en ${TIME_WINDOW_MS}ms`,
      '\nVérifiez les dépendances des useEffect et les conditions de rendu conditionnel.'
    );
  }
}

/**
 * Réinitialise l'historique (utile pour les tests)
 */
export function resetMountHistory() {
  if (process.env.NODE_ENV === 'development') {
    mountHistory.length = 0;
  }
}

