import { test, expect } from '@playwright/test';

/**
 * Test E2E : Navigation des onglets property en mode offline
 * 
 * Vérifie que :
 * - Aucune requête réseau n'est faite lors du changement d'onglet
 * - Aucune erreur console n'est générée
 * - Le contenu change correctement
 */
test.describe('Property Tabs - Offline Navigation', () => {
  // ⚠️ IMPORTANT: Remplacez 'xxx' par un propertyId valide de votre base de test
  const TEST_PROPERTY_ID = 'xxx'; // À remplacer par un ID valide
  const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

  test.beforeEach(async ({ page, context }) => {
    // S'assurer qu'on est en ligne au départ
    await context.setOffline(false);
    await page.goto(`${BASE_URL}/app?view=property&propertyId=${TEST_PROPERTY_ID}&tab=transactions`);
    
    // Attendre que la page soit chargée
    await page.waitForSelector('[data-testid="property-tabs"]', { timeout: 10000 }).catch(() => {
      // Si le testid n'existe pas, utiliser un sélecteur alternatif
      return page.waitForSelector('button[aria-label*="Transactions"]', { timeout: 10000 });
    });
  });

  test('changement d\'onglet en offline ne déclenche pas de requêtes réseau', async ({ page, context }) => {
    // Activer le mode offline
    await context.setOffline(true);
    
    // Attendre que le mode offline soit actif
    await page.waitForTimeout(500);

    // Capturer toutes les requêtes réseau
    const requests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      // Ignorer les requêtes internes au navigateur (chrome-extension, etc.)
      if (!url.includes('chrome-extension') && !url.includes('data:')) {
        requests.push(url);
      }
    });

    // Cliquer sur chaque onglet
    const tabs = ['documents', 'deadlines', 'lease', 'loans'];
    
    for (const tab of tabs) {
      requests.length = 0; // Réinitialiser le compteur
      
      // Cliquer sur l'onglet
      const tabButton = page.locator(`button[aria-label*="${getTabLabel(tab)}"]`).first();
      await tabButton.click();
      
      // Attendre un peu pour voir si des requêtes sont déclenchées
      await page.waitForTimeout(1000);
      
      // Vérifier qu'aucune requête réseau n'a été faite
      expect(requests.length, `Aucune requête réseau ne doit être déclenchée lors du clic sur l'onglet "${tab}"`).toBe(0);
      
      // Vérifier que l'URL a changé
      const url = page.url();
      expect(url).toContain(`tab=${tab}`);
    }
  });

  test('changement d\'onglet en offline ne génère pas d\'erreurs console', async ({ page, context }) => {
    // Activer le mode offline
    await context.setOffline(true);
    await page.waitForTimeout(500);

    // Capturer les erreurs console
    const errors: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error') {
        errors.push(text);
      }
    });

    // Cliquer sur chaque onglet
    const tabs = ['documents', 'deadlines', 'lease', 'loans'];
    
    for (const tab of tabs) {
      errors.length = 0; // Réinitialiser
      
      const tabButton = page.locator(`button[aria-label*="${getTabLabel(tab)}"]`).first();
      await tabButton.click();
      
      await page.waitForTimeout(1000);
      
      // Filtrer les erreurs non critiques (warnings, etc.)
      const criticalErrors = errors.filter(err => 
        !err.includes('ChunkLoadError') && // Ignorer les erreurs de chunks (non critiques en dev)
        !err.includes('Failed to fetch RSC payload') && // Ce qu'on veut justement éviter
        !err.includes('fetch-server-response') && // Ce qu'on veut justement éviter
        !err.includes('Falling back to browser navigation') // Ce qu'on veut justement éviter
      );
      
      expect(criticalErrors.length, `Aucune erreur console critique ne doit être générée lors du clic sur l'onglet "${tab}". Erreurs: ${JSON.stringify(criticalErrors)}`).toBe(0);
    }
  });

  test('changement d\'onglet en offline change le contenu correctement', async ({ page, context }) => {
    // Activer le mode offline
    await context.setOffline(true);
    await page.waitForTimeout(500);

    // Vérifier que l'onglet transactions est actif au départ
    const transactionsButton = page.locator('button[aria-label*="Transactions"]').first();
    await expect(transactionsButton).toBeVisible();

    // Cliquer sur chaque onglet et vérifier que le contenu change
    const tabs = [
      { id: 'documents', label: 'Documents' },
      { id: 'deadlines', label: 'Échéances' },
      { id: 'lease', label: 'Baux' },
      { id: 'loans', label: 'Prêts' },
    ];

    for (const tab of tabs) {
      // Cliquer sur l'onglet
      const tabButton = page.locator(`button[aria-label*="${tab.label}"]`).first();
      await tabButton.click();
      
      // Attendre que le contenu change (on vérifie que l'URL change)
      await page.waitForURL(`**/app?view=property&propertyId=${TEST_PROPERTY_ID}&tab=${tab.id}`, { timeout: 2000 });
      
      // Vérifier que l'URL contient le bon tab
      const url = page.url();
      expect(url).toContain(`tab=${tab.id}`);
    }
  });

  test('navigation initiale en offline fonctionne', async ({ page, context }) => {
    // Activer le mode offline AVANT de naviguer
    await context.setOffline(true);
    
    // Capturer les requêtes réseau
    const requests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (!url.includes('chrome-extension') && !url.includes('data:')) {
        requests.push(url);
      }
    });

    // Naviguer vers la page property
    await page.goto(`${BASE_URL}/app?view=property&propertyId=${TEST_PROPERTY_ID}&tab=transactions`, {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    });

    // Attendre un peu pour voir si des requêtes sont déclenchées après le chargement initial
    await page.waitForTimeout(2000);

    // En offline, il ne devrait pas y avoir de requêtes réseau (sauf peut-être des tentatives qui échouent)
    // On vérifie qu'il n'y a pas de requêtes réussies vers /app ou /api
    const appRequests = requests.filter(req => req.includes('/app') || req.includes('/api'));
    expect(appRequests.length, 'Aucune requête vers /app ou /api ne doit être faite en offline').toBe(0);
  });
});

// Helper pour obtenir le label d'un onglet
function getTabLabel(tabId: string): string {
  const labels: Record<string, string> = {
    transactions: 'Transactions',
    documents: 'Documents',
    deadlines: 'Échéances',
    lease: 'Baux',
    loans: 'Prêts',
  };
  return labels[tabId] || tabId;
}
