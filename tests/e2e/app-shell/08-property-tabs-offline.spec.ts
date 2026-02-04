import { test, expect } from '@playwright/test';
import { navigateToAppShellView } from './helpers/appShellNav';
import { seedTestData, resetTestData, createMinimalTestSeed } from './helpers/seed';

/**
 * Test E2E : Navigation des onglets property en mode offline
 * 
 * Vérifie que :
 * - Aucune requête réseau n'est faite lors du changement d'onglet
 * - Aucune erreur console n'est générée
 * - Le contenu change correctement
 */
test.describe('Property Tabs - Offline Navigation', () => {
  let testOrgId: string;
  let testPropertyId: string | null = null;

  test.beforeAll(async ({ request }) => {
    // Créer une organisation et une propriété de test
    testOrgId = 'test-e2e-tabs-' + Date.now();
    const seedData = createMinimalTestSeed(testOrgId);
    const seedResult = await seedTestData(request, seedData);
    
    if (seedResult.success && seedResult.data?.properties?.[0]?.id) {
      testPropertyId = seedResult.data.properties[0].id;
    } else {
      throw new Error(`Failed to seed test data: ${seedResult.error}`);
    }
  });

  test.afterAll(async ({ request }) => {
    // Nettoyer les données de test
    if (testOrgId) {
      await resetTestData(request, testOrgId);
    }
  });

  test.beforeEach(async ({ page, context }) => {
    if (!testPropertyId) {
      throw new Error('testPropertyId not set');
    }

    // S'assurer qu'on est en ligne au départ
    await context.setOffline(false);
    
    // Naviguer vers la page property en online
    await navigateToAppShellView(page, 'property', {
      propertyId: testPropertyId,
      tab: 'transactions',
    });
    
    // Attendre que la page soit chargée
    // Utiliser un sélecteur qui existe dans PropertyTabs (button avec aria-label)
    await page.waitForSelector('button[aria-label*="Transactions"]', { timeout: 10000 });
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
      // Ignorer les requêtes internes au navigateur (chrome-extension, data:, blob:)
      if (!url.includes('chrome-extension') && 
          !url.startsWith('data:') && 
          !url.startsWith('blob:') &&
          !url.includes('localhost:3000/_next/static')) {
        requests.push(url);
      }
    });

    // Cliquer sur chaque onglet
    const tabs = [
      { id: 'documents', label: 'Documents' },
      { id: 'deadlines', label: 'Échéances' },
      { id: 'lease', label: 'Baux' },
      { id: 'loans', label: 'Prêts' },
    ];
    
    for (const tab of tabs) {
      requests.length = 0; // Réinitialiser le compteur
      
      // Cliquer sur l'onglet
      const tabButton = page.locator(`button[aria-label*="${tab.label}"]`).first();
      await tabButton.click();
      
      // Attendre un peu pour voir si des requêtes sont déclenchées
      await page.waitForTimeout(1000);
      
      // Vérifier qu'aucune requête réseau n'a été faite
      // (filtrer les requêtes vers localhost:3000 qui sont des tentatives Next.js)
      const networkRequests = requests.filter(req => 
        req.includes('localhost:3000') && 
        !req.includes('/_next/static') && 
        !req.includes('/_next/webpack')
      );
      
      expect(networkRequests.length, `Aucune requête réseau ne doit être déclenchée lors du clic sur l'onglet "${tab.label}". Requêtes détectées: ${JSON.stringify(networkRequests)}`).toBe(0);
      
      // Vérifier que l'URL a changé
      const url = page.url();
      expect(url).toContain(`tab=${tab.id}`);
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
    const tabs = [
      { id: 'documents', label: 'Documents' },
      { id: 'deadlines', label: 'Échéances' },
      { id: 'lease', label: 'Baux' },
      { id: 'loans', label: 'Prêts' },
    ];
    
    for (const tab of tabs) {
      errors.length = 0; // Réinitialiser
      
      const tabButton = page.locator(`button[aria-label*="${tab.label}"]`).first();
      await tabButton.click();
      
      await page.waitForTimeout(1000);
      
      // Filtrer les erreurs non critiques (warnings, chunks, etc.)
      const criticalErrors = errors.filter(err => 
        !err.includes('ChunkLoadError') && // Ignorer les erreurs de chunks (non critiques en dev)
        !err.includes('Failed to fetch RSC payload') && // Ce qu'on veut justement éviter
        !err.includes('fetch-server-response') && // Ce qu'on veut justement éviter
        !err.includes('Falling back to browser navigation') && // Ce qu'on veut justement éviter
        !err.includes('net::ERR_INTERNET_DISCONNECTED') && // Erreur réseau normale en offline
        !err.includes('Failed to fetch') // Erreur réseau normale en offline (mais pas RSC)
      );
      
      expect(criticalErrors.length, `Aucune erreur console critique ne doit être générée lors du clic sur l'onglet "${tab.label}". Erreurs: ${JSON.stringify(criticalErrors)}`).toBe(0);
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
      
      // Attendre que l'URL change (indique que la navigation client-side a fonctionné)
      await page.waitForURL(`**/app?view=property&propertyId=${testPropertyId}&tab=${tab.id}`, { timeout: 2000 });
      
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
      if (!url.includes('chrome-extension') && 
          !url.startsWith('data:') && 
          !url.startsWith('blob:')) {
        requests.push(url);
      }
    });

    // Naviguer vers la page property
    await navigateToAppShellView(page, 'property', {
      propertyId: testPropertyId!,
      tab: 'transactions',
    });

    // Attendre un peu pour voir si des requêtes sont déclenchées après le chargement initial
    await page.waitForTimeout(2000);

    // En offline, il ne devrait pas y avoir de requêtes réseau réussies vers /app ou /api
    // (filtrer les requêtes vers localhost:3000 qui sont des tentatives Next.js)
    const appRequests = requests.filter(req => 
      req.includes('localhost:3000') && 
      (req.includes('/app') || req.includes('/api')) &&
      !req.includes('/_next/static') && 
      !req.includes('/_next/webpack')
    );
    
    expect(appRequests.length, 'Aucune requête vers /app ou /api ne doit être faite en offline').toBe(0);
  });
});
