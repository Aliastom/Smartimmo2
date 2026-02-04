/**
 * Helpers pour gérer le mode offline/online dans Playwright
 */

import { Page, BrowserContext } from 'playwright/test';

/**
 * Passe le navigateur en mode offline
 */
export async function setOffline(context: BrowserContext): Promise<void> {
  await context.setOffline(true);
  
  // Vérifier que navigator.onLine est bien false
  const page = context.pages()[0] || await context.newPage();
  const isOnline = await page.evaluate(() => navigator.onLine);
  
  if (isOnline) {
    throw new Error('❌ Le navigateur n\'est pas en mode offline');
  }
}

/**
 * Passe le navigateur en mode online
 */
export async function setOnline(context: BrowserContext): Promise<void> {
  await context.setOffline(false);
  
  // Attendre que navigator.onLine soit true
  const page = context.pages()[0] || await context.newPage();
  
  await page.waitForFunction(() => navigator.onLine === true, {
    timeout: 5000,
  });
}

/**
 * Vérifie que l'application détecte correctement le mode offline
 */
export async function assertAppDetectsOffline(page: Page): Promise<void> {
  // Vérifier qu'un indicateur offline est affiché (si présent)
  // ou qu'aucune requête réseau n'est faite pour les données métier
  
  // Attendre un peu pour que l'app détecte le changement
  await page.waitForTimeout(1000);
  
  // Vérifier que navigator.onLine est false côté page
  const isOnline = await page.evaluate(() => navigator.onLine);
  
  if (isOnline) {
    throw new Error('❌ La page ne détecte pas le mode offline');
  }
}

/**
 * Vérifie qu'aucune requête réseau n'est faite pour les données métier en app-shell offline
 */
export async function assertNoNetworkRequestsForData(
  page: Page,
  allowedPatterns: string[] = []
): Promise<void> {
  const requests: string[] = [];
  
  // Écouter les requêtes réseau
  page.on('request', (request) => {
    const url = request.url();
    
    // Ignorer les requêtes autorisées (assets, service worker, etc.)
    const isAllowed = allowedPatterns.some(pattern => url.includes(pattern));
    
    // Ignorer les requêtes vers /api/log (logging)
    if (url.includes('/api/log')) {
      return;
    }
    
    // Ignorer les requêtes vers /_next (bundles Next.js)
    if (url.includes('/_next')) {
      return;
    }
    
    // Ignorer les requêtes vers /api/auth (authentification)
    if (url.includes('/api/auth')) {
      return;
    }
    
    // Détecter les requêtes vers les APIs métier (non autorisées en app-shell offline)
    if (url.includes('/api/properties') || 
        url.includes('/api/leases') || 
        url.includes('/api/transactions') ||
        url.includes('/api/tenants') ||
        url.includes('/api/documents') ||
        url.includes('/api/loans') ||
        url.includes('/api/echeances')) {
      if (!isAllowed) {
        requests.push(url);
      }
    }
  });
  
  // Attendre un peu pour capturer les requêtes
  await page.waitForTimeout(2000);
  
  if (requests.length > 0) {
    throw new Error(
      `❌ Requêtes réseau détectées en mode app-shell offline:\n` +
      requests.map(r => `  - ${r}`).join('\n') +
      `\nEn app-shell offline, aucune requête vers les APIs métier ne doit être faite.`
    );
  }
}

/**
 * Attend que la synchronisation soit terminée (via événement sync:refresh)
 */
export async function waitForSyncComplete(page: Page, timeout: number = 30000): Promise<void> {
  await page.waitForFunction(
    () => {
      // Vérifier que l'événement sync:refresh a été émis
      return (window as any).__playwright_sync_complete === true;
    },
    { timeout }
  ).catch(async () => {
    // Si l'événement n'est pas émis, vérifier manuellement
    // en attendant que les pendingOps soient vides
    await page.waitForFunction(
      async () => {
        try {
          const { getLocalDB } = await import('@/lib/offline/db');
          const db = await getLocalDB();
          const pendingCount = await db.pendingOperations.where('status').equals('pending').count();
          return pendingCount === 0;
        } catch {
          return false;
        }
      },
      { timeout: timeout / 2 }
    );
  });
}

/**
 * Écoute les événements de sync pour les tests
 */
export async function setupSyncEventListeners(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Marquer les événements de sync
    window.addEventListener('sync:refresh', () => {
      (window as any).__playwright_sync_complete = true;
    });
    
    window.addEventListener('fullSync:complete', () => {
      (window as any).__playwright_full_sync_complete = true;
    });
    
    // Réinitialiser les flags
    (window as any).__playwright_sync_complete = false;
    (window as any).__playwright_full_sync_complete = false;
  });
}
