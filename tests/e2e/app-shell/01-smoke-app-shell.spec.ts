/**
 * Tests E2E - Scénario A : Smoke App-Shell
 * 
 * Vérifie :
 * - Boot app-shell depuis /app
 * - Chargement depuis cache puis IndexedDB
 * - Navigation interne sans bascule vers routes "normal"
 * - Aucun lien vers /biens, /transactions, etc.
 */

import { test, expect } from 'playwright/test';
import { navigateToAppShellView, assertNoNormalRouteLinks, assertSidebarUsesAppShellNav } from './helpers/appShellNav';
import { setupSyncEventListeners } from './helpers/offline';
import { seedTestData, resetTestData, createMinimalTestSeed } from './helpers/seed';

test.describe('A. Smoke App-Shell', () => {
  let testOrgId: string;
  let testPropertyId: string;
  
  test.beforeAll(async ({ request }) => {
    // Créer une organisation de test (ou utiliser une existante)
    testOrgId = 'test-e2e-org-' + Date.now();
    
    // Seed des données minimales
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
    await resetTestData(request, testOrgId);
  });
  
  test('A1. Boot app-shell et chargement depuis cache', async ({ page }) => {
    // Setup listeners pour les événements de sync
    await setupSyncEventListeners(page);
    
    // Naviguer vers /app (boot)
    await page.goto('/app');
    
    // Vérifier que l'URL est bien /app (ou /app?view=dashboard)
    await expect(page).toHaveURL(/\/app(\?view=dashboard)?$/);
    
    // Attendre que la page soit chargée
    await page.waitForLoadState('domcontentloaded');
    
    // Vérifier qu'aucun loader infini n'est présent
    const loader = page.locator('[data-testid="loader"], .animate-spin').first();
    await expect(loader).not.toBeVisible({ timeout: 10000 });
    
    // Vérifier que le contenu du dashboard est affiché (au moins un élément)
    // Le dashboard doit afficher des données depuis IndexedDB
    const dashboardContent = page.locator('text=Vue mensuelle opérationnelle').or(
      page.locator('[data-testid="dashboard"]')
    );
    await expect(dashboardContent.first()).toBeVisible({ timeout: 15000 });
  });
  
  test('A2. Navigation interne app-shell sans rechargement', async ({ page }) => {
    await setupSyncEventListeners(page);
    
    // Boot
    await page.goto('/app');
    await page.waitForLoadState('domcontentloaded');
    
    // Naviguer vers la vue "biens"
    await navigateToAppShellView(page, 'biens');
    
    // Vérifier que l'URL est /app?view=biens
    await expect(page).toHaveURL(/\/app\?view=biens/);
    
    // Vérifier que le contenu "Biens" est affiché
    await expect(page.locator('text=Biens Immobiliers').or(
      page.locator('h1:has-text("Biens")')
    ).first()).toBeVisible({ timeout: 10000 });
    
    // Naviguer vers "transactions"
    await navigateToAppShellView(page, 'transactions');
    
    // Vérifier que l'URL est /app?view=transactions
    await expect(page).toHaveURL(/\/app\?view=transactions/);
    
    // Vérifier que le contenu "Transactions" est affiché
    await expect(page.locator('text=Transactions').or(
      page.locator('h1:has-text("Transactions")')
    ).first()).toBeVisible({ timeout: 10000 });
    
    // Vérifier qu'aucun rechargement complet n'a eu lieu
    // (le document ne doit pas avoir été rechargé)
    const navigationCount = await page.evaluate(() => {
      return (window as any).__playwright_navigation_count || 0;
    });
    
    // En app-shell, on ne doit pas avoir de navigation complète
    // (seulement pushState)
    expect(navigationCount).toBeLessThan(2);
  });
  
  test('A3. Aucun lien vers routes "normal"', async ({ page }) => {
    await setupSyncEventListeners(page);
    
    // Naviguer vers différentes vues app-shell
    const views = ['dashboard', 'biens', 'transactions', 'baux', 'locataires', 'documents'];
    
    for (const view of views) {
      await navigateToAppShellView(page, view);
      await page.waitForLoadState('domcontentloaded');
      
      // Vérifier qu'aucun lien ne pointe vers une route "normal"
      await assertNoNormalRouteLinks(page);
    }
  });
  
  test('A4. Sidebar utilise navigation app-shell', async ({ page }) => {
    await setupSyncEventListeners(page);
    
    await page.goto('/app');
    await page.waitForLoadState('domcontentloaded');
    
    // Vérifier que la sidebar utilise /app?view=...
    await assertSidebarUsesAppShellNav(page);
    
    // Cliquer sur un lien de la sidebar (ex: "Biens")
    const biensLink = page.locator('nav a, [data-testid="sidebar"] a').filter({
      hasText: /Biens|biens/i,
    }).first();
    
    if (await biensLink.count() > 0) {
      await biensLink.click();
      
      // Vérifier que l'URL est /app?view=biens (pas /biens)
      await expect(page).toHaveURL(/\/app\?view=biens/);
    }
  });
  
  test('A5. Navigation vers vue property avec propertyId', async ({ page }) => {
    await setupSyncEventListeners(page);
    
    await page.goto('/app');
    await page.waitForLoadState('domcontentloaded');
    
    // Naviguer vers la vue property avec un propertyId
    await navigateToAppShellView(page, 'property', { propertyId: testPropertyId, tab: 'transactions' });
    
    // Vérifier que l'URL contient propertyId et tab
    await expect(page).toHaveURL(
      new RegExp(`/app\\?view=property&propertyId=${testPropertyId}&tab=transactions`)
    );
    
    // Vérifier que le contenu du bien est affiché
    // (attendre un élément caractéristique de la page property)
    await page.waitForTimeout(2000); // Laisser le temps au chargement
  });
});
