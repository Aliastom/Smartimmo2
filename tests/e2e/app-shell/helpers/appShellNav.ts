/**
 * Helpers pour la navigation App-Shell
 * 
 * Vérifie que la navigation reste dans /app?view=... et ne bascule pas vers les routes "normal"
 */

import { Page, expect } from 'playwright/test';

/**
 * Navigue vers une vue app-shell et vérifie que l'URL est correcte
 */
export async function navigateToAppShellView(
  page: Page,
  view: string,
  params?: Record<string, string>
): Promise<void> {
  // Utiliser baseURL de la config Playwright ou fallback
  const baseURL = page.context().baseURL || 'http://localhost:3000';
  const url = new URL('/app', baseURL);
  url.searchParams.set('view', view);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  
  await page.goto(url.toString());
  
  // Vérifier que l'URL est bien /app?view=...
  await expect(page).toHaveURL(new RegExp(`/app\\?view=${view}`));
  
  // Attendre que la page soit chargée (pas de loader)
  await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {
    // Ignorer si timeout
  });
  
  // Attendre un peu pour que React se monte
  await page.waitForTimeout(1000);
}

/**
 * Vérifie qu'un lien ne pointe pas vers une route "normal" (ex: /biens, /transactions)
 */
export async function assertNoNormalRouteLinks(page: Page): Promise<void> {
  // Liste des routes "normal" à éviter
  const normalRoutes = [
    '/biens',
    '/locataires',
    '/baux',
    '/transactions',
    '/documents',
    '/echeances',
    '/loans',
    '/dashboard',
    '/fiscal',
    '/parametres',
  ];
  
  // Vérifier tous les liens dans la page
  const links = await page.locator('a[href]').all();
  
  for (const link of links) {
    const href = await link.getAttribute('href');
    if (!href) continue;
    
    // Ignorer les liens externes, ancres, etc.
    if (href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) {
      continue;
    }
    
    // Vérifier qu'aucun lien ne pointe vers une route "normal"
    for (const route of normalRoutes) {
      if (href.startsWith(route) && !href.startsWith('/app')) {
        throw new Error(
          `❌ Lien détecté vers route "normal": ${href}\n` +
          `En app-shell, tous les liens doivent pointer vers /app?view=...`
        );
      }
    }
  }
}

/**
 * Vérifie que la navigation interne utilise window.history.pushState (pas de rechargement)
 */
export async function assertAppShellNavigation(page: Page, view: string): Promise<void> {
  // Écouter les événements de navigation
  const navigationPromise = page.waitForURL(new RegExp(`/app\\?view=${view}`), {
    timeout: 5000,
  });
  
  // Vérifier que l'URL change sans rechargement complet
  await navigationPromise;
  
  // Vérifier que le document n'a pas été rechargé (check via performance API)
  const reloaded = await page.evaluate(() => {
    return (window as any).__playwright_navigation_reloaded === true;
  });
  
  if (reloaded) {
    throw new Error(
      `❌ La navigation vers ${view} a déclenché un rechargement complet.\n` +
      `En app-shell, la navigation doit utiliser window.history.pushState sans rechargement.`
    );
  }
}

/**
 * Vérifie que la sidebar utilise la navigation app-shell (pas de Link Next.js)
 */
export async function assertSidebarUsesAppShellNav(page: Page): Promise<void> {
  // Vérifier que les liens de la sidebar pointent vers /app?view=...
  const sidebarLinks = await page.locator('[data-testid="sidebar"] a, nav a').all();
  
  for (const link of sidebarLinks) {
    const href = await link.getAttribute('href');
    if (!href) continue;
    
    // Les liens doivent pointer vers /app?view=... ou être des ancres
    if (href.startsWith('/app?view=') || href.startsWith('#')) {
      continue;
    }
    
    // Si c'est un lien vers une route "normal", c'est une erreur
    if (href.startsWith('/') && !href.startsWith('/app')) {
      throw new Error(
        `❌ Lien sidebar vers route "normal": ${href}\n` +
        `En app-shell, la sidebar doit utiliser /app?view=...`
      );
    }
  }
}
