/**
 * Fonction de récupération pour l'ouverture de la base de données IndexedDB
 * Gère les erreurs UnknownError, InvalidStateError avec retry et fallback
 * 
 * ⚠️ CRITIQUE: Cette fonction centralise toute la logique d'ouverture de la DB
 * et garantit que l'application ne reste jamais bloquée.
 * 
 * ⚠️ CLIENT-ONLY: Ne peut être utilisée que côté client
 */

import type { LocalDbStatus } from '@/contexts/LocalDbStatusContext';

export interface DbOpenResult {
  db: any;
  status: LocalDbStatus;
  error?: Error;
}

// ⚠️ CRITIQUE: Garde anti-boucle pour éviter les retries multiples
let lastRetryTime = 0;
const RETRY_COOLDOWN_MS = 5000; // 5 secondes entre les retries

/**
 * Ouvre la base de données avec mécanisme de récupération
 * 
 * @param dbInstance - Instance Dexie à ouvrir
 * @param setStatusCallback - Callback pour mettre à jour le statut global (optionnel)
 * @param forceRetry - Forcer un retry même si récemment échoué (pour bouton "Réessayer")
 * @returns Résultat avec la base ouverte ou une erreur
 */
export async function openDbWithRecovery(
  dbInstance: any,
  setStatusCallback?: (status: LocalDbStatus, error?: Error | null) => void,
  forceRetry: boolean = false
): Promise<DbOpenResult> {
  // ⚠️ CRITIQUE: Vérifier que nous sommes côté client
  if (typeof window === 'undefined') {
    return { db: null, status: 'UNAVAILABLE', error: new Error('openDbWithRecovery() ne peut être appelé que côté client') };
  }
  
  // Vérifier si la base est déjà ouverte
  if (dbInstance.isOpen()) {
    return { db: dbInstance, status: 'OK' };
  }
  
  // ⚠️ GARDE ANTI-BOUCLE: Ne pas réessayer trop souvent
  const now = Date.now();
  if (!forceRetry && (now - lastRetryTime) < RETRY_COOLDOWN_MS) {
    console.warn('[openDbWithRecovery] ⚠️ Retry ignoré (cooldown actif)');
    return { db: null, status: 'UNAVAILABLE', error: new Error('Retry cooldown active') };
  }
  lastRetryTime = now;

  let lastError: Error | null = null;

  // Tentative 1 : Ouverture normale
  try {
    await dbInstance.open();
    console.log('[openDbWithRecovery] ✅ DB_OPEN_SUCCESS (tentative 1)');
    if (setStatusCallback) {
      setStatusCallback('OK', null);
    }
    return { db: dbInstance, status: 'OK' };
  } catch (error: any) {
    lastError = error;
    console.error('[openDbWithRecovery] ❌ DB_OPEN_FAILED (tentative 1):', error.message);
    
    // Vérifier le type d'erreur
    const isUnknownError = error.name === 'UnknownError' || error.message?.includes('UnknownError');
    const isInvalidStateError = error.name === 'InvalidStateError' || error.message?.includes('InvalidStateError');
    
    if (!isUnknownError && !isInvalidStateError) {
      // Erreur non récupérable, arrêter immédiatement
      if (setStatusCallback) {
        setStatusCallback('UNAVAILABLE', error);
      }
      return { db: null, status: 'UNAVAILABLE', error };
    }
  }

  // Tentative 2 : Fermer et rouvrir (workaround pour UnknownError)
  try {
    console.log('[openDbWithRecovery] 🔄 DB_OPEN_RETRY (tentative 2)');
    
    // Fermer la base si elle est partiellement ouverte
    try {
      if (dbInstance.isOpen()) {
        await dbInstance.close();
      }
    } catch (closeError) {
      // Ignorer les erreurs de fermeture
      console.warn('[openDbWithRecovery] ⚠️ Erreur lors de la fermeture (ignorée):', closeError);
    }
    
    // Attendre un court délai pour permettre à IndexedDB de se libérer
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Réessayer l'ouverture
    await dbInstance.open();
    
    console.log('[openDbWithRecovery] ✅ DB_OPEN_RETRY_SUCCESS (tentative 2)');
    if (setStatusCallback) {
      setStatusCallback('RECOVERED', null);
    }
    return { db: dbInstance, status: 'RECOVERED' };
  } catch (error: any) {
    lastError = error;
    console.error('[openDbWithRecovery] ❌ DB_OPEN_RETRY_FAILED (tentative 2):', error.message);
  }

  // Si les deux tentatives ont échoué, la base est indisponible
  if (setStatusCallback) {
    setStatusCallback('UNAVAILABLE', lastError);
  }
  return { db: null, status: 'UNAVAILABLE', error: lastError || new Error('Unknown error') };
}

